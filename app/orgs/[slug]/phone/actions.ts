"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import {
  buildSelectedTools,
  createUltravoxCall,
  type CustomToolInput,
  type ToolParameter,
} from "@/lib/ultravox";
import {
  listTwilioIncomingNumbers,
  placeOutboundCall,
  saveOrgTwilioCredentials,
  setTwilioVoiceWebhook,
} from "@/lib/twilio";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatch";

/* ────────────────────────────────────────────────────────────────
   Twilio credentials
   ──────────────────────────────────────────────────────────────── */

const CredsSchema = z.object({
  accountSid: z
    .string()
    .trim()
    .regex(/^AC[a-f0-9]{32}$/i, "Account SID must look like AC followed by 32 hex chars."),
  authToken: z.string().trim().min(10, "Auth token is too short."),
});

export type CredsActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export async function saveTwilioCredentialsAction(
  _prev: CredsActionState,
  formData: FormData,
): Promise<CredsActionState> {
  const slug = formData.get("orgSlug") as string | null;
  if (!slug) return { status: "error", message: "Missing workspace." };
  const tenant = await requireTenant(slug);

  const parsed = CredsSchema.safeParse({
    accountSid: formData.get("accountSid"),
    authToken: formData.get("authToken"),
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid credentials.",
    };

  try {
    await saveOrgTwilioCredentials(
      tenant.organizationId,
      parsed.data.accountSid,
      parsed.data.authToken,
    );
    revalidatePath(`/orgs/${tenant.orgSlug}/phone`);
    return { status: "success", message: "Twilio connected." };
  } catch (err) {
    unstable_rethrow(err);
    return {
      status: "error",
      message:
        err instanceof Error
          ? `Twilio rejected the credentials: ${err.message}`
          : "Could not save credentials.",
    };
  }
}

/* ────────────────────────────────────────────────────────────────
   Phone number registry
   ──────────────────────────────────────────────────────────────── */

export async function importTwilioNumbersAction(
  slug: string,
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  try {
    const tenant = await requireTenant(slug);
    const numbers = await listTwilioIncomingNumbers(tenant.organizationId);
    let imported = 0;
    for (const n of numbers) {
      const existing = await db.phoneNumber.findUnique({
        where: { e164: n.e164 },
      });
      if (existing) continue;
      await db.phoneNumber.create({
        data: {
          organizationId: tenant.organizationId,
          e164: n.e164,
          label: n.friendlyName,
          provider: "twilio",
          providerSid: n.sid,
        },
      });
      imported += 1;
    }
    revalidatePath(`/orgs/${tenant.orgSlug}/phone`);
    return { ok: true, imported };
  } catch (err) {
    unstable_rethrow(err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not import numbers from Twilio.",
    };
  }
}

export async function updatePhoneNumberAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const phoneNumberId = formData.get("phoneNumberId") as string | null;
  if (!slug || !phoneNumberId) return;

  const tenant = await requireTenant(slug);

  const label = (formData.get("label") as string | null)?.trim() || null;
  const inboundAgentId =
    (formData.get("inboundAgentId") as string | null) || null;

  if (inboundAgentId) {
    // Validate agent belongs to this org.
    const agent = await db.agent.findFirst({
      where: { id: inboundAgentId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!agent) return;
  }

  const phone = await db.phoneNumber.findFirst({
    where: {
      id: phoneNumberId,
      organizationId: tenant.organizationId,
    },
  });
  if (!phone) return;

  await db.phoneNumber.update({
    where: { id: phone.id },
    data: { label, inboundAgentId },
  });

  // If the user just assigned an inbound agent and this is a Twilio-managed
  // number, point Twilio's voiceUrl at our inbound handler so the number
  // actually routes calls to the agent.
  if (inboundAgentId && phone.providerSid && phone.provider === "twilio") {
    const publicUrl = process.env.PUBLIC_APP_URL;
    if (publicUrl) {
      try {
        await setTwilioVoiceWebhook(
          tenant.organizationId,
          phone.providerSid,
          `${publicUrl.replace(/\/$/, "")}/api/twilio/voice`,
        );
        await db.phoneNumber.update({
          where: { id: phone.id },
          data: { inboundWebhookSet: true },
        });
      } catch (err) {
        console.error("[phone] failed to update Twilio voiceUrl:", err);
        // Non-fatal — user can retry via the UI.
      }
    }
  }

  revalidatePath(`/orgs/${tenant.orgSlug}/phone`);
}

export async function deletePhoneNumberAction(formData: FormData) {
  const slug = formData.get("orgSlug") as string | null;
  const phoneNumberId = formData.get("phoneNumberId") as string | null;
  if (!slug || !phoneNumberId) return;

  const tenant = await requireTenant(slug);
  await db.phoneNumber.deleteMany({
    where: {
      id: phoneNumberId,
      organizationId: tenant.organizationId,
    },
  });
  revalidatePath(`/orgs/${tenant.orgSlug}/phone`);
}

/* ────────────────────────────────────────────────────────────────
   Outbound dialer
   ──────────────────────────────────────────────────────────────── */

const DialSchema = z.object({
  agentId: z.string().trim().min(1),
  fromNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "From number must be E.164, e.g. +15551234567."),
  toNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "To number must be E.164, e.g. +15551234567."),
});

export type DialActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; callId: string };

export async function dialOutboundAction(
  _prev: DialActionState,
  formData: FormData,
): Promise<DialActionState> {
  const slug = formData.get("orgSlug") as string | null;
  if (!slug) return { status: "error", message: "Missing workspace." };
  const tenant = await requireTenant(slug);

  const parsed = DialSchema.safeParse({
    agentId: formData.get("agentId"),
    fromNumber: formData.get("fromNumber"),
    toNumber: formData.get("toNumber"),
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };

  const agent = await db.agent.findFirst({
    where: { id: parsed.data.agentId, organizationId: tenant.organizationId },
    include: { tools: true, knowledgeBases: true },
  });
  if (!agent) return { status: "error", message: "Agent not found." };
  if (!agent.ultravoxAgentId)
    return {
      status: "error",
      message: "This agent isn't connected to Ultravox.",
    };

  // Sanity check: org owns the fromNumber.
  const fromOwned = await db.phoneNumber.findFirst({
    where: {
      organizationId: tenant.organizationId,
      e164: parsed.data.fromNumber,
    },
  });
  if (!fromOwned)
    return {
      status: "error",
      message: "From number isn't registered in this workspace.",
    };

  try {
    // Build full tool set (custom + built-in + corpora) for this call so
    // outbound calls get the same capabilities the agent has everywhere else.
    const customTools: CustomToolInput[] = agent.tools.map((t) => ({
      name: t.name,
      description: t.description,
      url: t.url,
      httpMethod: t.httpMethod,
      headers: (t.headersJson as Record<string, string> | null) ?? null,
      parameters: (t.parametersJson as ToolParameter[] | null) ?? null,
    }));
    const corpusIds = agent.knowledgeBases
      .map((kb) => kb.ultravoxCorpusId)
      .filter((id): id is string => Boolean(id));
    const selectedTools = buildSelectedTools({
      enableHangUp: agent.enableHangUp,
      enableTransfer: agent.enableTransfer,
      transferPhoneNumber: agent.transferPhoneNumber,
      enableVoicemail: agent.enableVoicemail,
      enablePlayDtmf: agent.enablePlayDtmf,
      customTools,
      corpusIds,
    });

    const uvCall = await createUltravoxCall(agent.ultravoxAgentId, {
      medium: "twilio",
      firstSpeaker: "user",
      maxDurationSec: 1800,
      metadata: {
        source: "outbound_phone",
        initiatedByClerkId: tenant.userId,
        orgSlug: tenant.orgSlug,
        toNumber: parsed.data.toNumber,
        fromNumber: parsed.data.fromNumber,
      },
      extraSelectedTools: selectedTools,
    });

    const placed = await placeOutboundCall(tenant.organizationId, {
      toNumber: parsed.data.toNumber,
      fromNumber: parsed.data.fromNumber,
      joinUrl: uvCall.joinUrl,
    });

    const call = await db.call.create({
      data: {
        organizationId: tenant.organizationId,
        agentId: agent.id,
        initiatedByClerkId: tenant.userId,
        ultravoxCallId: uvCall.callId,
        twilioCallSid: placed.twilioCallSid,
        status: "CONNECTING",
        direction: "OUTBOUND",
        fromNumber: parsed.data.fromNumber,
        toNumber: parsed.data.toNumber,
      },
    });

    await db.activityLog.create({
      data: {
        organizationId: tenant.organizationId,
        actorClerkId: tenant.userId,
        action: "call.outbound.placed",
        subject: parsed.data.toNumber,
        metadata: {
          callId: call.id,
          agentId: agent.id,
          twilioCallSid: placed.twilioCallSid,
        },
      },
    });

    revalidatePath(`/orgs/${tenant.orgSlug}/phone`);
    revalidatePath(`/orgs/${tenant.orgSlug}/dashboard`);

    await dispatchWebhookEvent(tenant.organizationId, "call.started", {
      callId: call.id,
      agentId: agent.id,
      direction: "OUTBOUND",
      fromNumber: parsed.data.fromNumber,
      toNumber: parsed.data.toNumber,
    });

    return { status: "success", callId: call.id };
  } catch (err) {
    unstable_rethrow(err);
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Could not place the call.",
    };
  }
}
