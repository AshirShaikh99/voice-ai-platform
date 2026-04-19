import "server-only";

import crypto from "node:crypto";

import { db } from "./db";

/**
 * Outbound webhooks that notify customer systems when events happen inside
 * the platform. We sign every payload with HMAC-SHA256 so customers can
 * verify authenticity against the signing secret shown in the dashboard.
 *
 * Delivery is fire-and-forget: we await nothing, log failures to stderr, and
 * move on. If/when we grow a delivery-attempt log table, wire it up here.
 */

export type WebhookEventName =
  | "call.ended"
  | "call.started"
  | "agent.created"
  | "agent.updated"
  | "agent.deleted";

export async function dispatchWebhookEvent(
  organizationId: string,
  event: WebhookEventName,
  payload: Record<string, unknown>,
): Promise<void> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { organizationId, active: true },
  });
  if (endpoints.length === 0) return;

  const body = JSON.stringify({
    event,
    occurredAt: new Date().toISOString(),
    data: payload,
  });

  // Fire all deliveries in parallel, don't block the caller on slow customers.
  await Promise.allSettled(
    endpoints.map(async (ep) => {
      const events = (ep.eventsJson as unknown as string[]) ?? [];
      if (!events.includes(event) && !events.includes("*")) return;

      const signature = crypto
        .createHmac("sha256", ep.signingSecret)
        .update(body)
        .digest("hex");

      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Webhook-Signature": `sha256=${signature}`,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          console.error(
            `[webhook] ${event} → ${ep.url} failed: ${res.status}`,
          );
        }
      } catch (err) {
        console.error(
          `[webhook] ${event} → ${ep.url} threw:`,
          err instanceof Error ? err.message : err,
        );
      }
    }),
  );
}

/** Generate a secure 32-byte signing secret, base64-encoded. */
export function generateSigningSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}
