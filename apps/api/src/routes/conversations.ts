import type { FastifyInstance } from "fastify";
import { getConversation, getMessagesForConversation, recordOutboundMessage } from "@polar/conversation";
import { listIdentities } from "@polar/crm";
import { MetaCloudApiAdapter } from "@polar/whatsapp";
import { polarError } from "@polar/security";
import { requirePermission } from "../plugins/auth.js";
import type { AppConfig } from "../config.js";

/**
 * Conversation + admin-triggered outbound send — see docs/whatsapp/whatsapp-architecture.md.
 * This is human-handoff / manual-send infrastructure (an operator replying
 * from the admin app), not the AI response path — the AI Orchestrator
 * (Phase 3) will call the same @polar/whatsapp adapter through its own
 * RESPONSE GENERATION stage, never directly from the model
 * (docs/architecture/ai-architecture.md §1).
 */
export async function conversationRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get<{ Params: { id: string } }>(
    "/conversations/:id",
    { preHandler: requirePermission("conversation.read") },
    async (request) => {
      const conversation = await getConversation(request.params.id);
      if (!conversation) {
        throw polarError("CUSTOMER_NOT_FOUND", `Conversation ${request.params.id} not found.`);
      }
      return conversation;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/conversations/:id/messages",
    { preHandler: requirePermission("conversation.read") },
    async (request) => {
      return getMessagesForConversation(request.params.id);
    },
  );

  app.post<{ Params: { id: string }; Body: { text: string } }>(
    "/conversations/:id/messages",
    { preHandler: requirePermission("conversation.manage") },
    async (request) => {
      const conversation = await getConversation(request.params.id);
      if (!conversation) {
        throw polarError("CUSTOMER_NOT_FOUND", `Conversation ${request.params.id} not found.`);
      }
      if (!request.body?.text) {
        throw polarError("VALIDATION_ERROR", "text is required.");
      }

      const { accessToken, phoneNumberId } = config.whatsapp;
      if (!accessToken || !phoneNumberId) {
        throw polarError("WHATSAPP_UNAVAILABLE", "WhatsApp send credentials are not configured.");
      }

      const identities = await listIdentities(conversation.customerId);
      const waIdentity = identities.find((i) => i.type === "whatsapp" || i.type === "phone");
      if (!waIdentity) {
        throw polarError("VALIDATION_ERROR", "Customer has no WhatsApp/phone identity to send to.");
      }

      const adapter = new MetaCloudApiAdapter({ accessToken, phoneNumberId });
      const result = await adapter.sendText({ to: waIdentity.value, body: request.body.text });

      return recordOutboundMessage({
        conversationId: conversation.id,
        customerId: conversation.customerId,
        providerMessageId: result.providerMessageId,
        messageType: "text",
        bodyText: request.body.text,
      });
    },
  );
}
