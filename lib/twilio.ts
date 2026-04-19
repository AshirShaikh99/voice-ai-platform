import "server-only";

import twilio from "twilio";

import { decryptSecret, encryptSecret } from "./crypto";
import { db } from "./db";

/**
 * Thin wrapper around the Twilio Node SDK that loads per-org credentials
 * from our database. Never import `twilio` directly from elsewhere — always
 * go through this file so credentials stay in one place.
 */

export type TwilioClient = ReturnType<typeof twilio>;

/** Load a TwilioClient for the given organization, or null if none configured. */
export async function loadOrgTwilioClient(
  organizationId: string,
): Promise<{ client: TwilioClient; accountSid: string } | null> {
  const account = await db.telephonyAccount.findUnique({
    where: { organizationId },
  });
  if (!account) return null;
  const authToken = decryptSecret(account.authTokenEnc);
  return {
    client: twilio(account.accountSid, authToken),
    accountSid: account.accountSid,
  };
}

/** Save (upsert) Twilio credentials for an org. Token is encrypted at rest. */
export async function saveOrgTwilioCredentials(
  organizationId: string,
  accountSid: string,
  authToken: string,
): Promise<void> {
  // Validate by making a lightweight API call before persisting.
  const client = twilio(accountSid, authToken);
  // .fetch() on the account sub-resource throws on auth failure.
  await client.api.v2010.accounts(accountSid).fetch();

  const enc = encryptSecret(authToken);
  await db.telephonyAccount.upsert({
    where: { organizationId },
    create: {
      organizationId,
      provider: "twilio",
      accountSid,
      authTokenEnc: enc,
    },
    update: {
      accountSid,
      authTokenEnc: enc,
    },
  });
}

/**
 * Place an outbound call that bridges the called party to an Ultravox
 * Media Streams websocket. `joinUrl` is the wss:// URL returned from
 * createUltravoxCall({ medium: "twilio" }).
 */
export async function placeOutboundCall(
  organizationId: string,
  input: { toNumber: string; fromNumber: string; joinUrl: string },
): Promise<{ twilioCallSid: string }> {
  const loaded = await loadOrgTwilioClient(organizationId);
  if (!loaded)
    throw new Error("Twilio is not configured for this organization.");

  // Escape the joinUrl for safe inclusion in TwiML. joinUrl is a Twilio
  // Media Streams wss://... URL; it should never contain XML-breaking chars
  // in practice, but we defensively encode to be safe.
  const streamUrl = input.joinUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const twiml = `<Response><Connect><Stream url="${streamUrl}"/></Connect></Response>`;

  const call = await loaded.client.calls.create({
    to: input.toNumber,
    from: input.fromNumber,
    twiml,
  });

  return { twilioCallSid: call.sid };
}

/**
 * Update the Twilio-side voiceUrl for a given Phone Number SID so inbound
 * calls route into our /api/twilio/voice handler. Twilio POSTs there with
 * call metadata; we return TwiML that bridges to Ultravox.
 */
export async function setTwilioVoiceWebhook(
  organizationId: string,
  providerSid: string,
  voiceUrl: string,
): Promise<void> {
  const loaded = await loadOrgTwilioClient(organizationId);
  if (!loaded)
    throw new Error("Twilio is not configured for this organization.");
  await loaded.client.incomingPhoneNumbers(providerSid).update({
    voiceUrl,
    voiceMethod: "POST",
  });
}

/** Verify an inbound HTTP request came from Twilio via their signature header. */
export function verifyTwilioRequest(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  // Twilio signature: base64(hmac-sha1(authToken, url + concat of sorted params))
  // We inline a minimal impl to avoid pulling twilio's validateRequest at the
  // edge; the shape matches Twilio's spec exactly.
  const sortedKeys = Object.keys(params).sort();
  const data =
    url +
    sortedKeys
      .map((k) => `${k}${params[k] ?? ""}`)
      .join("");
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(data)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

/** Load the org's decrypted Twilio auth token (for signature verification). */
export async function loadOrgTwilioAuthToken(
  organizationId: string,
): Promise<string | null> {
  const account = await db.telephonyAccount.findUnique({
    where: { organizationId },
  });
  if (!account) return null;
  return decryptSecret(account.authTokenEnc);
}

/** List Twilio phone numbers on the org's account (for import into our registry). */
export async function listTwilioIncomingNumbers(
  organizationId: string,
): Promise<Array<{ sid: string; e164: string; friendlyName: string }>> {
  const loaded = await loadOrgTwilioClient(organizationId);
  if (!loaded) return [];
  const nums = await loaded.client.incomingPhoneNumbers.list({ limit: 100 });
  return nums.map((n) => ({
    sid: n.sid,
    e164: n.phoneNumber,
    friendlyName: n.friendlyName ?? n.phoneNumber,
  }));
}
