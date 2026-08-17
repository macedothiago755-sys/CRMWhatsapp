import { and, desc, eq, inArray } from "drizzle-orm";
import { conversationSchema, getDb } from "@polar/database";
import { assertTransition, isTerminal, type ConversationState } from "./stateMachine.js";

/**
 * Conversation read/write — see docs/architecture/domain-model.md §2 and
 * docs/architecture/system-overview.md §4 for the state machine this wraps.
 */
const NON_TERMINAL_STATES: ConversationState[] = [
  "NEW",
  "ACTIVE",
  "QUALIFYING",
  "RECOMMENDING",
  "PURCHASING",
  "CHECKOUT",
  "POST_PURCHASE",
  "ESCALATED",
];

export async function getOrCreateActiveConversation(customerId: string, channel = "whatsapp") {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(conversationSchema.conversation)
    .where(
      and(
        eq(conversationSchema.conversation.customerId, customerId),
        inArray(conversationSchema.conversation.status, NON_TERMINAL_STATES),
      ),
    )
    .orderBy(desc(conversationSchema.conversation.startedAt))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(conversationSchema.conversation)
    .values({ customerId, channel, status: "NEW" })
    .returning();

  if (!created) {
    throw new Error("Failed to create conversation.");
  }
  return created;
}

export async function getConversation(conversationId: string) {
  const db = getDb();
  const [conversation] = await db
    .select()
    .from(conversationSchema.conversation)
    .where(eq(conversationSchema.conversation.id, conversationId))
    .limit(1);
  return conversation ?? null;
}

export async function transitionConversation(conversationId: string, toState: ConversationState) {
  const db = getDb();
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found.`);
  }

  assertTransition(conversation.status as ConversationState, toState);

  const [updated] = await db
    .update(conversationSchema.conversation)
    .set({
      status: toState,
      updatedAt: new Date(),
      resolvedAt: isTerminal(toState) ? new Date() : undefined,
    })
    .where(eq(conversationSchema.conversation.id, conversationId))
    .returning();

  return updated;
}

export async function touchLastMessageAt(conversationId: string, at: Date = new Date()) {
  const db = getDb();
  await db
    .update(conversationSchema.conversation)
    .set({ lastMessageAt: at, updatedAt: new Date() })
    .where(eq(conversationSchema.conversation.id, conversationId));
}
