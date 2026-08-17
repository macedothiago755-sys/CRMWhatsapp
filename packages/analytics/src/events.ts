import { createHash } from "node:crypto";

/**
 * Event log helpers — see docs/architecture/event-model.md.
 * `analytics.event` is the single append-only producer path (ADR-0010); this
 * module is the only place a `dedupe_key` is derived, so every producer computes
 * it the same way.
 */
export const CANONICAL_EVENT_TYPES = [
  "customer.created",
  "conversation.started",
  "message.received",
  "message.sent",
  "intent.detected",
  "product.recommended",
  "product.selected",
  "cart.created",
  "cart.item_added",
  "checkout.started",
  "order.created",
  "order.paid",
  "order.delivered",
  "campaign.sent",
  "campaign.delivered",
  "campaign.converted",
  "consent.granted",
  "consent.revoked",
] as const;

export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];

/**
 * Event types are extensible beyond the canonical list above (event-model.md §2)
 * — validated as `<entity>.<past-tense-verb>`, not restricted to a closed enum.
 */
const EVENT_TYPE_PATTERN = /^[a-z_]+\.[a-z_]+$/;

export function isValidEventType(eventType: string): boolean {
  return EVENT_TYPE_PATTERN.test(eventType);
}

export function deriveDedupeKey(source: string, providerId: string, eventType: string): string {
  return createHash("sha256").update(`${source}:${providerId}:${eventType}`).digest("hex");
}

export interface AnalyticsEventInput {
  eventType: string;
  dedupeKey: string;
  customerId?: string;
  conversationId?: string;
  entityType?: string;
  entityId?: string;
  source: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

export function validateEventInput(input: AnalyticsEventInput): void {
  if (!isValidEventType(input.eventType)) {
    throw new Error(
      `Invalid event_type "${input.eventType}" — expected "<entity>.<past-tense-verb>" (docs/architecture/event-model.md §2).`,
    );
  }
  if (!input.dedupeKey) {
    throw new Error("Analytics events require a dedupe_key for idempotency (docs/architecture/event-model.md §3).");
  }
}
