/**
 * Conversation state machine — see docs/architecture/system-overview.md §4 and
 * database/migrations/0001_init.sql (conversation.conversation.status CHECK).
 */
export const CONVERSATION_STATES = [
  "NEW",
  "ACTIVE",
  "QUALIFYING",
  "RECOMMENDING",
  "PURCHASING",
  "CHECKOUT",
  "POST_PURCHASE",
  "RESOLVED",
  "ESCALATED",
  "FAILED",
  "BLOCKED",
] as const;

export type ConversationState = (typeof CONVERSATION_STATES)[number];

const HAPPY_PATH: Partial<Record<ConversationState, ConversationState[]>> = {
  NEW: ["ACTIVE"],
  ACTIVE: ["QUALIFYING", "RESOLVED"],
  QUALIFYING: ["RECOMMENDING"],
  RECOMMENDING: ["PURCHASING"],
  PURCHASING: ["CHECKOUT"],
  CHECKOUT: ["POST_PURCHASE"],
  POST_PURCHASE: ["RESOLVED"],
};

/**
 * ESCALATED, FAILED, and BLOCKED are reachable from any non-terminal state —
 * a human handoff, an unrecoverable error, or an abuse/policy block can happen
 * at any point in the journey. RESOLVED, FAILED, and BLOCKED are terminal.
 */
const TERMINAL_STATES: ReadonlySet<ConversationState> = new Set(["RESOLVED", "FAILED", "BLOCKED"]);
const ALWAYS_REACHABLE: ConversationState[] = ["ESCALATED", "FAILED", "BLOCKED"];

export function getAllowedTransitions(from: ConversationState): ConversationState[] {
  if (TERMINAL_STATES.has(from)) {
    return [];
  }
  const happyPathNext = HAPPY_PATH[from] ?? [];
  return [...new Set([...happyPathNext, ...ALWAYS_REACHABLE])];
}

export function canTransition(from: ConversationState, to: ConversationState): boolean {
  return getAllowedTransitions(from).includes(to);
}

export function isTerminal(state: ConversationState): boolean {
  return TERMINAL_STATES.has(state);
}

export class InvalidTransitionError extends Error {
  constructor(from: ConversationState, to: ConversationState) {
    super(`Invalid conversation state transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: ConversationState, to: ConversationState): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
