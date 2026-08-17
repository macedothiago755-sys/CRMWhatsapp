import {
  appendTimelineEvent,
  resolveOrCreateCustomer,
  revokeConsentSystem,
} from "@polar/crm";
import {
  getOrCreateActiveConversation,
  recordInboundMessage,
  transitionConversation,
  updateMessageStatusByProviderId,
  type MessageType,
} from "@polar/conversation";
import { isOptOutMessage, normalizeInboundPayload, type RawWebhookPayload } from "@polar/whatsapp";
import { logger } from "@polar/observability";

/**
 * Inbound WhatsApp webhook processing — the async side of
 * docs/architecture/integration-architecture.md §3. Called by the BullMQ
 * worker (production) or directly (tests) — kept as a plain function so it's
 * testable without a running queue, while the queue provides the actual
 * at-least-once delivery/retry/backoff/DLQ semantics around it.
 *
 * Idempotent by construction: message persistence dedupes on
 * provider_message_id (see @polar/conversation), so redelivery of the same
 * webhook payload is always safe to reprocess.
 */
export async function processInboundWhatsAppPayload(payload: unknown): Promise<void> {
  const { messages, statuses } = normalizeInboundPayload(payload as RawWebhookPayload);

  for (const message of messages) {
    await processInboundMessage(message);
  }

  for (const status of statuses) {
    await updateMessageStatusByProviderId(status.providerMessageId, status.status);
  }
}

async function processInboundMessage(message: {
  waId: string;
  providerMessageId: string;
  messageType: string;
  bodyText: string | undefined;
  timestamp: Date;
  raw: unknown;
}): Promise<void> {
  const resolution = await resolveOrCreateCustomer([{ type: "whatsapp", value: message.waId }]);

  if (resolution.outcome === "ambiguous") {
    // Never guess which customer this belongs to — see docs/architecture/
    // domain-model.md §3. The message is not persisted against any customer;
    // it's logged for operational visibility until merge review (admin app,
    // not yet built) resolves the candidate.
    logger.warn(
      { waId: message.waId, mergeCandidateId: resolution.mergeCandidateId },
      "Inbound WhatsApp message from an identity with ambiguous customer match — skipped pending merge review",
    );
    return;
  }

  const customerId = resolution.customerId;
  const conversation = await getOrCreateActiveConversation(customerId, "whatsapp");
  if (conversation.status === "NEW") {
    await transitionConversation(conversation.id, "ACTIVE");
  }

  const { message: stored, deduped } = await recordInboundMessage({
    conversationId: conversation.id,
    customerId,
    providerMessageId: message.providerMessageId,
    messageType: message.messageType as MessageType,
    bodyText: message.bodyText,
    payload: message.raw as Record<string, unknown>,
    sentAt: message.timestamp,
  });

  if (deduped) {
    return; // already processed this exact message — skip side effects to avoid double-counting
  }

  await appendTimelineEvent({
    customerId,
    eventType: "message.received",
    title: "WhatsApp message received",
    entityType: "message",
    entityId: stored.id,
    occurredAt: message.timestamp,
  });

  if (isOptOutMessage(message.bodyText)) {
    await revokeConsentSystem(customerId, "marketing", "whatsapp-opt-out-keyword");
    await appendTimelineEvent({
      customerId,
      eventType: "consent.revoked",
      title: "Customer opted out of marketing via WhatsApp keyword",
      entityType: "consent",
    });
  }
}
