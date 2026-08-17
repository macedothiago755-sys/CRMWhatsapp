export {
  CONVERSATION_STATES,
  type ConversationState,
  getAllowedTransitions,
  canTransition,
  isTerminal,
  InvalidTransitionError,
  assertTransition,
} from "./stateMachine.js";
export {
  getOrCreateActiveConversation,
  getConversation,
  transitionConversation,
  touchLastMessageAt,
} from "./conversationService.js";
export {
  type MessageType,
  type RecordInboundMessageInput,
  type RecordOutboundMessageInput,
  type RecordMessageResult,
  recordInboundMessage,
  recordOutboundMessage,
  updateMessageStatusByProviderId,
  getMessagesForConversation,
} from "./messageService.js";
