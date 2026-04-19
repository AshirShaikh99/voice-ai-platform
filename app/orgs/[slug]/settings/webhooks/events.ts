/**
 * The set of event names customers can subscribe to. Keep in sync with
 * WebhookEventName in `lib/webhook-dispatch.ts`.
 */
export const AVAILABLE_EVENTS = [
  "call.started",
  "call.ended",
  "agent.created",
  "agent.updated",
  "agent.deleted",
] as const;

export type AvailableEvent = (typeof AVAILABLE_EVENTS)[number];
