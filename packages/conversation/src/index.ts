export {
  CONVERSATION_STATES,
  type ConversationState,
  getAllowedTransitions,
  canTransition,
  isTerminal,
  InvalidTransitionError,
  assertTransition,
} from "./stateMachine.js";
