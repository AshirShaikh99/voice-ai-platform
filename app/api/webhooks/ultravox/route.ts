import "server-only";

import crypto from "node:crypto";

import { onCampaignCallEnded } from "@/lib/campaigns";
import { db } from "@/lib/db";
import {
  getUltravoxCall,
  getUltravoxCallMessages,
  getUltravoxRecordingUrl,
} from "@/lib/ultravox";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatch";

/**
 * Ultravox webhook receiver.
 *
 * Configure the endpoint URL (e.g. https://your.app/api/webhooks/ultravox) in
 * the Ultravox dashboard and subscribe to `call.ended` and `call.billed`.
 * Copy the signing secret into `ULTRAVOX_WEBHOOK_SECRET` in your env.
 *
 * Ultravox signs every payload: the header `X-Ultravox-Webhook-Signature`
 * contains `sha256=<hex>` where <hex> is HMAC-SHA256 of the raw body.
 * If the secret isn't set we reject all requests — safer than opening
 * an un-authenticated mutation endpoint.
 */

export const runtime = "nodejs";

type UltravoxWebhookPayload = {
  event: string;
  call?: {
    callId: string;
    created?: string;
    joined?: string | null;
    ended?: string | null;
    endReason?: string | null;
    shortSummary?: string | null;
    summary?: string | null;
  };
};

function verifySignature(rawBody: string, headerValue: string | null): boolean {
  const secret = process.env.ULTRAVOX_WEBHOOK_SECRET;
  if (!secret || !headerValue) return false;

  // Accept "sha256=<hex>" or bare "<hex>".
  const provided = headerValue.startsWith("sha256=")
    ? headerValue.slice("sha256=".length)
    : headerValue;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expected, "hex"),
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-ultravox-webhook-signature");

  if (!verifySignature(rawBody, signature)) {
    return new Response("Invalid signature.", { status: 401 });
  }

  let payload: UltravoxWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as UltravoxWebhookPayload;
  } catch {
    return new Response("Malformed JSON.", { status: 400 });
  }

  const ultravoxCallId = payload.call?.callId;
  if (!ultravoxCallId) {
    // Not every Ultravox event carries a call (future-proofing). Ack and drop.
    return Response.json({ ok: true, ignored: payload.event });
  }

  const call = await db.call.findUnique({
    where: { ultravoxCallId },
    select: {
      id: true,
      organizationId: true,
      agentId: true,
      startedAt: true,
      campaignTargetId: true,
    },
  });
  if (!call) {
    // Not our call (or created outside this platform). Ack so Ultravox doesn't retry.
    return Response.json({ ok: true, ignored: "unknown_call" });
  }

  if (payload.event === "call.ended") {
    // Webhook payload may not include summaries yet — they generate async.
    // Pull the latest state from Ultravox to get whatever's ready right now.
    const [uvCall, transcript, recordingUrl] = await Promise.allSettled([
      getUltravoxCall(ultravoxCallId),
      getUltravoxCallMessages(ultravoxCallId),
      getUltravoxRecordingUrl(ultravoxCallId),
    ]);

    const ended = payload.call?.ended
      ? new Date(payload.call.ended)
      : new Date();
    const durationSec = Math.max(
      0,
      Math.round((ended.getTime() - call.startedAt.getTime()) / 1000),
    );

    const uvCallValue = uvCall.status === "fulfilled" ? uvCall.value : null;
    const shortSummary =
      uvCallValue?.shortSummary ?? payload.call?.shortSummary ?? null;
    const summary = uvCallValue?.summary ?? payload.call?.summary ?? null;

    await db.call.update({
      where: { id: call.id },
      data: {
        status: "ENDED",
        endedAt: ended,
        durationSec,
        endReason: payload.call?.endReason ?? null,
        shortSummary,
        summary,
        recordingUrl:
          recordingUrl.status === "fulfilled" ? recordingUrl.value : null,
        transcriptJson:
          transcript.status === "fulfilled" && transcript.value.length > 0
            ? (transcript.value as unknown as object)
            : undefined,
      },
    });

    await db.activityLog.create({
      data: {
        organizationId: call.organizationId,
        actorClerkId: "system",
        action: "call.ended.webhook",
        subject: `${durationSec}s`,
        metadata: {
          callId: call.id,
          endReason: payload.call?.endReason ?? null,
        },
      },
    });

    // Fan out to customer-registered webhook endpoints.
    await dispatchWebhookEvent(call.organizationId, "call.ended", {
      callId: call.id,
      agentId: call.agentId,
      durationSec,
      endReason: payload.call?.endReason ?? null,
      shortSummary,
      summary,
    });

    // If this call belongs to a campaign, mark the target done and dial next.
    if (call.campaignTargetId) {
      try {
        await onCampaignCallEnded(call.id, call.campaignTargetId);
      } catch (err) {
        console.error("[campaign] advance failed:", err);
      }
    }
  } else if (payload.event === "call.billed") {
    // Billing event arrives shortly after end. Re-pull summaries because they
    // often land between call.ended and call.billed.
    try {
      const uvCall = await getUltravoxCall(ultravoxCallId);
      if (uvCall.shortSummary || uvCall.summary) {
        await db.call.update({
          where: { id: call.id },
          data: {
            shortSummary: uvCall.shortSummary ?? null,
            summary: uvCall.summary ?? null,
          },
        });
      }
    } catch {
      // Non-fatal.
    }
  }

  return Response.json({ ok: true, event: payload.event });
}
