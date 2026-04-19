import "server-only";

import { db } from "./db";
import {
  buildSelectedTools,
  createUltravoxCall,
  type CustomToolInput,
  type ToolParameter,
} from "./ultravox";
import { placeOutboundCall } from "./twilio";

/**
 * The campaign "engine". Self-propelling: whenever a call ends (via the
 * Ultravox webhook receiver), we check whether it belongs to a campaign and,
 * if so, call `advanceCampaign()` to dial the next queued target. That keeps
 * the in-flight count at or below the campaign's concurrency level without
 * any long-running worker process.
 *
 * First kick: when the user clicks "Start", `advanceCampaign()` is called
 * once which dials `concurrency` targets in parallel. From then on the
 * webhook handles progression.
 */

/**
 * Dial queued targets until we reach the campaign's concurrency cap.
 * Returns the number of targets that were dialed in this invocation.
 */
export async function advanceCampaign(campaignId: string): Promise<number> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: { agent: { include: { tools: true, knowledgeBases: true } } },
  });
  if (!campaign) return 0;
  if (campaign.status !== "RUNNING") return 0;
  if (!campaign.agent.ultravoxAgentId) return 0;

  const inFlight = await db.campaignTarget.count({
    where: { campaignId: campaign.id, status: "DIALING" },
  });
  const slots = Math.max(0, campaign.concurrency - inFlight);
  if (slots === 0) return 0;

  // Pull the next batch of QUEUED targets.
  const batch = await db.campaignTarget.findMany({
    where: { campaignId: campaign.id, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: slots,
  });

  if (batch.length === 0) {
    // Nothing left to dial and nothing in-flight? Campaign is done.
    if (inFlight === 0) {
      const remaining = await db.campaignTarget.count({
        where: {
          campaignId: campaign.id,
          status: { in: ["QUEUED", "DIALING"] },
        },
      });
      if (remaining === 0) {
        await db.campaign.update({
          where: { id: campaign.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
    }
    return 0;
  }

  // Build the agent's full selectedTools once — identical per call.
  const customTools: CustomToolInput[] = campaign.agent.tools.map((t) => ({
    name: t.name,
    description: t.description,
    url: t.url,
    httpMethod: t.httpMethod,
    headers: (t.headersJson as Record<string, string> | null) ?? null,
    parameters: (t.parametersJson as ToolParameter[] | null) ?? null,
  }));
  const corpusIds = campaign.agent.knowledgeBases
    .map((kb) => kb.ultravoxCorpusId)
    .filter((id): id is string => Boolean(id));
  const selectedTools = buildSelectedTools({
    enableHangUp: campaign.agent.enableHangUp,
    enableTransfer: campaign.agent.enableTransfer,
    transferPhoneNumber: campaign.agent.transferPhoneNumber,
    enableVoicemail: campaign.agent.enableVoicemail,
    enablePlayDtmf: campaign.agent.enablePlayDtmf,
    customTools,
    corpusIds,
  });

  // Mark DIALING first so a concurrent webhook doesn't double-dial.
  await db.campaignTarget.updateMany({
    where: { id: { in: batch.map((t) => t.id) } },
    data: {
      status: "DIALING",
      dialedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  const ultravoxAgentId = campaign.agent.ultravoxAgentId;
  let dialed = 0;

  await Promise.allSettled(
    batch.map(async (target) => {
      try {
        const templateContext: Record<string, string> = {
          contactName: target.contactName ?? "",
          toNumber: target.toNumber,
        };
        const vars = (target.variablesJson as Record<string, string>) ?? {};
        for (const [k, v] of Object.entries(vars)) {
          if (typeof v === "string") templateContext[k] = v;
        }

        const uvCall = await createUltravoxCall(ultravoxAgentId, {
          medium: "twilio",
          firstSpeaker: "user",
          maxDurationSec: 600,
          templateContext,
          metadata: {
            source: "campaign",
            campaignId: campaign.id,
            targetId: target.id,
          },
          extraSelectedTools: selectedTools,
        });

        const placed = await placeOutboundCall(campaign.organizationId, {
          toNumber: target.toNumber,
          fromNumber: campaign.fromNumber,
          joinUrl: uvCall.joinUrl,
        });

        await db.call.create({
          data: {
            organizationId: campaign.organizationId,
            agentId: campaign.agentId,
            initiatedByClerkId: "campaign",
            ultravoxCallId: uvCall.callId,
            twilioCallSid: placed.twilioCallSid,
            status: "CONNECTING",
            direction: "OUTBOUND",
            fromNumber: campaign.fromNumber,
            toNumber: target.toNumber,
            campaignTargetId: target.id,
          },
        });

        dialed += 1;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown dialing error.";
        // Failed to place → decide retry vs give up.
        await db.campaignTarget.update({
          where: { id: target.id },
          data: {
            status:
              target.attempts + 1 >= campaign.maxAttempts ? "FAILED" : "QUEUED",
            lastError: message,
          },
        });
      }
    }),
  );

  return dialed;
}

/**
 * Called from the Ultravox call.ended webhook. Marks the target COMPLETED
 * and kicks the next batch.
 */
export async function onCampaignCallEnded(
  callId: string,
  campaignTargetId: string,
): Promise<void> {
  const target = await db.campaignTarget.findUnique({
    where: { id: campaignTargetId },
    include: { campaign: true, call: true },
  });
  if (!target) return;

  await db.campaignTarget.update({
    where: { id: target.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await advanceCampaign(target.campaignId);
}
