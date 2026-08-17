import { desc, eq } from "drizzle-orm";
import { conversationSchema, getDb } from "@polar/database";
import { touchLastMessageAt } from "./conversationService.js";

/**
 * Message persistence — see docs/architecture/integration-architecture.md §5:
 * idempotency keyed on provider_message_id (the Meta WhatsApp message id).
 * A webhook redelivery of the same message must be a safe no-op, never a
 * second row / a double-counted event.
 */
export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "interactive"
  | "template"
  | "location"
  | "sticker"
  | "contacts"
  | "unknown";

export interface RecordInboundMessageInput {
  conversationId: string;
  customerId: string;
  providerMessageId: string;
  messageType: MessageType;
  bodyText?: string | undefined;
  payload?: Record<string, unknown> | undefined;
  sentAt?: Date | undefined;
}

export interface RecordMessageResult<T> {
  message: T;
  /** true if this call found an existing row rather than inserting a new one. */
  deduped: boolean;
}

export async function recordInboundMessage(
  input: RecordInboundMessageInput,
): Promise<RecordMessageResult<typeof conversationSchema.message.$inferSelect>> {
  const db = getDb();

  const inserted = await db
    .insert(conversationSchema.message)
    .values({
      conversationId: input.conversationId,
      customerId: input.customerId,
      direction: "inbound",
      messageType: input.messageType,
      providerMessageId: input.providerMessageId,
      status: "received",
      bodyText: input.bodyText,
      payload: input.payload ?? {},
      sentAt: input.sentAt,
    })
    .onConflictDoNothing({ target: conversationSchema.message.providerMessageId })
    .returning();

  if (inserted[0]) {
    await touchLastMessageAt(input.conversationId, input.sentAt ?? new Date());
    return { message: inserted[0], deduped: false };
  }

  const [existing] = await db
    .select()
    .from(conversationSchema.message)
    .where(eq(conversationSchema.message.providerMessageId, input.providerMessageId))
    .limit(1);

  if (!existing) {
    throw new Error(
      `recordInboundMessage: conflict on ${input.providerMessageId} but no existing row found — this should not happen.`,
    );
  }
  return { message: existing, deduped: true };
}

export interface RecordOutboundMessageInput {
  conversationId: string;
  customerId: string;
  providerMessageId: string;
  messageType: MessageType;
  bodyText?: string | undefined;
  payload?: Record<string, unknown> | undefined;
}

export async function recordOutboundMessage(input: RecordOutboundMessageInput) {
  const db = getDb();
  const now = new Date();

  const [created] = await db
    .insert(conversationSchema.message)
    .values({
      conversationId: input.conversationId,
      customerId: input.customerId,
      direction: "outbound",
      messageType: input.messageType,
      providerMessageId: input.providerMessageId,
      status: "sent",
      bodyText: input.bodyText,
      payload: input.payload ?? {},
      sentAt: now,
    })
    .onConflictDoNothing({ target: conversationSchema.message.providerMessageId })
    .returning();

  await touchLastMessageAt(input.conversationId, now);
  return created ?? null;
}

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  received: [],
  sent: ["delivered", "read", "failed"],
  delivered: ["read", "failed"],
  read: [],
  failed: [],
};

/** Applied from an inbound delivery/read/failed status webhook. Silently ignores an unknown message id — the message may predate this system or belong to another number. */
export async function updateMessageStatusByProviderId(
  providerMessageId: string,
  newStatus: "sent" | "delivered" | "read" | "failed",
): Promise<boolean> {
  const db = getDb();
  const [existing] = await db
    .select({ id: conversationSchema.message.id, status: conversationSchema.message.status })
    .from(conversationSchema.message)
    .where(eq(conversationSchema.message.providerMessageId, providerMessageId))
    .limit(1);

  if (!existing) return false;
  if (!VALID_STATUS_TRANSITIONS[existing.status]?.includes(newStatus)) {
    return false; // out-of-order or duplicate delivery of an older status — ignore
  }

  await db
    .update(conversationSchema.message)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(conversationSchema.message.id, existing.id));
  return true;
}

export async function getMessagesForConversation(conversationId: string, limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(conversationSchema.message)
    .where(eq(conversationSchema.message.conversationId, conversationId))
    .orderBy(desc(conversationSchema.message.createdAt))
    .limit(limit);
}
