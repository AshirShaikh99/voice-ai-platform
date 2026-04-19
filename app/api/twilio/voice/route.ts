import "server-only";

import { db } from "@/lib/db";
import {
  loadOrgTwilioAuthToken,
  verifyTwilioRequest,
} from "@/lib/twilio";
import {
  buildSelectedTools,
  createUltravoxCall,
  type CustomToolInput,
  type ToolParameter,
} from "@/lib/ultravox";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatch";

/**
 * Inbound voice webhook for Twilio.
 *
 * Flow:
 *   1. Twilio POSTs here when someone calls one of our numbers.
 *   2. We look up the called number (`To`) to find which agent should answer.
 *   3. Create an Ultravox call with Twilio medium + firstSpeaker=agent so the
 *      agent greets the caller.
 *   4. Return TwiML that streams the call into the Ultravox wss://... URL.
 *
 * Auth: we verify Twilio's signature using the org's auth token. We can't
 * know which org this is until we've matched the `To` number, so the order
 * is: parse params → find PhoneNumber → verify signature → do work.
 */

export const runtime = "nodejs";

function errorTwiml(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${escapeXml(message)}</Say><Hangup/></Response>`;
  return new Response(twiml, {
    status: 200, // Always 200 to Twilio — they'll retry otherwise.
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") params[k] = v;
  }

  const toNumber = params["To"];
  const fromNumber = params["From"];
  const twilioCallSid = params["CallSid"];

  if (!toNumber || !twilioCallSid) {
    return errorTwiml("Sorry, this line is misconfigured. Please try again later.");
  }

  const phoneNumber = await db.phoneNumber.findUnique({
    where: { e164: toNumber },
    include: {
      inboundAgent: {
        include: { tools: true, knowledgeBases: true },
      },
    },
  });
  if (!phoneNumber) {
    return errorTwiml(
      "We couldn't route your call. Please try a different number.",
    );
  }

  // Signature verification. Twilio signs every request with the account auth
  // token; we look it up by organization and HMAC-compare.
  const authToken = await loadOrgTwilioAuthToken(phoneNumber.organizationId);
  if (!authToken) {
    return errorTwiml("This number isn't configured. Please try later.");
  }
  const signature = request.headers.get("x-twilio-signature");
  // Twilio computes signature against the FULL request URL it sent you. In
  // Next dev the URL is localhost, but when Twilio actually hits us in prod
  // the X-Forwarded-Host dance is handled by Vercel/Netlify so request.url is
  // the real one. We use a defensive normalization.
  const url = new URL(request.url);
  const publicUrl = process.env.PUBLIC_APP_URL
    ? `${process.env.PUBLIC_APP_URL.replace(/\/$/, "")}${url.pathname}`
    : request.url;
  if (!verifyTwilioRequest(authToken, signature, publicUrl, params)) {
    return new Response("Invalid Twilio signature.", { status: 401 });
  }

  if (!phoneNumber.inboundAgent) {
    return errorTwiml(
      "Thanks for calling. We're not staffing this line right now. Please try again later.",
    );
  }
  const agent = phoneNumber.inboundAgent;
  if (!agent.ultravoxAgentId) {
    return errorTwiml(
      "This agent isn't ready. Please try again in a few minutes.",
    );
  }

  try {
    // Build the full tool set so inbound calls match the agent's everywhere-else
    // capabilities (hangUp, queryCorpus, transfer, etc.).
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
      firstSpeaker: "agent",
      maxDurationSec: 1800,
      metadata: {
        source: "inbound_phone",
        orgId: phoneNumber.organizationId,
        fromNumber: fromNumber ?? "",
        toNumber,
        twilioCallSid,
      },
      extraSelectedTools: selectedTools,
    });

    await db.call.create({
      data: {
        organizationId: phoneNumber.organizationId,
        agentId: agent.id,
        initiatedByClerkId: "system",
        ultravoxCallId: uvCall.callId,
        twilioCallSid,
        status: "CONNECTING",
        direction: "INBOUND",
        fromNumber: fromNumber ?? null,
        toNumber,
      },
    });

    await db.activityLog.create({
      data: {
        organizationId: phoneNumber.organizationId,
        actorClerkId: "system",
        action: "call.inbound.answered",
        subject: agent.name,
        metadata: { twilioCallSid, fromNumber, toNumber },
      },
    });

    await dispatchWebhookEvent(phoneNumber.organizationId, "call.started", {
      agentId: agent.id,
      direction: "INBOUND",
      fromNumber,
      toNumber,
      twilioCallSid,
    });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${escapeXml(uvCall.joinUrl)}"/></Connect></Response>`;
    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[twilio/voice] failed to bridge call:", err);
    return errorTwiml(
      "Sorry, something went wrong connecting you. Please try again in a moment.",
    );
  }
}
