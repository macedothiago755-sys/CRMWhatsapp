/**
 * WhatsApp Cloud API inbound webhook payload shape and normalization.
 *
 * Field names below are pinned against the current WhatsApp Cloud API webhook
 * documentation (Meta for Developers, "Webhooks" / "Components" reference) as
 * verified via web search on 2026-08-17 — direct fetch of developers.facebook.com
 * was blocked by this environment's network egress proxy, so this was
 * cross-checked against multiple independent secondary sources rather than the
 * primary doc page directly. RE-VERIFY against the live Meta developer
 * dashboard/docs before this goes to production (master prompt §79-80) — API
 * versions and field additions do change over time.
 *
 * Top-level shape:
 *   { object: "whatsapp_business_account", entry: [ { id, changes: [ { field, value } ] } ] }
 * `value` carries `metadata` (display_phone_number, phone_number_id), and either
 * a `messages` array (inbound messages) or a `statuses` array (delivery/read/
 * failed status updates for messages we sent), plus `contacts` alongside messages.
 */

export interface RawWebhookPayload {
  object?: string;
  entry?: RawEntry[];
}

interface RawEntry {
  id?: string;
  changes?: RawChange[];
}

interface RawChange {
  field?: string;
  value?: RawValue;
}

interface RawValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: RawMessage[];
  statuses?: RawStatus[];
}

interface RawMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  [key: string]: unknown;
}

interface RawStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
}

export interface NormalizedInboundMessage {
  waId: string;
  providerMessageId: string;
  messageType: string;
  bodyText: string | undefined;
  contactName: string | undefined;
  phoneNumberId: string | undefined;
  timestamp: Date;
  raw: RawMessage;
}

export type NormalizedMessageStatus = "sent" | "delivered" | "read" | "failed";

export interface NormalizedStatusUpdate {
  providerMessageId: string;
  status: NormalizedMessageStatus;
  recipientWaId: string | undefined;
  timestamp: Date;
}

export interface NormalizedWebhookEvent {
  messages: NormalizedInboundMessage[];
  statuses: NormalizedStatusUpdate[];
}

const KNOWN_MESSAGE_TYPES = new Set([
  "text",
  "image",
  "audio",
  "video",
  "document",
  "interactive",
  "location",
  "sticker",
  "contacts",
]);

function toDate(unixSeconds: string | undefined): Date {
  const n = Number(unixSeconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
}

function normalizeMessageType(type: string | undefined): string {
  if (!type) return "unknown";
  return KNOWN_MESSAGE_TYPES.has(type) ? type : "unknown";
}

/**
 * Parses a raw webhook POST body into normalized message/status events.
 * Tolerant by design: an unrecognized or partially-malformed entry is skipped,
 * not thrown — a single bad element must never fail the whole webhook delivery
 * (Meta will retry the same payload on a non-2xx response, which would otherwise
 * wedge on the same bad element forever).
 */
export function normalizeInboundPayload(payload: RawWebhookPayload): NormalizedWebhookEvent {
  const messages: NormalizedInboundMessage[] = [];
  const statuses: NormalizedStatusUpdate[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const value = change.value;
      const contactByWaId = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));

      for (const rawMessage of value.messages ?? []) {
        if (!rawMessage.from || !rawMessage.id) continue; // can't process without a sender/id
        messages.push({
          waId: rawMessage.from,
          providerMessageId: rawMessage.id,
          messageType: normalizeMessageType(rawMessage.type),
          bodyText: rawMessage.type === "text" ? rawMessage.text?.body : undefined,
          contactName: contactByWaId.get(rawMessage.from),
          phoneNumberId: value.metadata?.phone_number_id,
          timestamp: toDate(rawMessage.timestamp),
          raw: rawMessage,
        });
      }

      for (const rawStatus of value.statuses ?? []) {
        if (!rawStatus.id || !rawStatus.status) continue;
        if (!["sent", "delivered", "read", "failed"].includes(rawStatus.status)) continue;
        statuses.push({
          providerMessageId: rawStatus.id,
          status: rawStatus.status as NormalizedMessageStatus,
          recipientWaId: rawStatus.recipient_id,
          timestamp: toDate(rawStatus.timestamp),
        });
      }
    }
  }

  return { messages, statuses };
}
