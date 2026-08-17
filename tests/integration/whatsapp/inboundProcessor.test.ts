import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "@polar/database";
import { createCustomer, findIdentityMatches, isConsentGranted, grantConsentSystem } from "@polar/crm";
import { getMessagesForConversation, getOrCreateActiveConversation } from "@polar/conversation";
import { processInboundWhatsAppPayload } from "../../../apps/api/src/services/inboundWhatsAppProcessor.js";

afterAll(async () => {
  await closePool();
});

function textMessagePayload(waId: string, providerMessageId: string, body: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "pn-1" },
              contacts: [{ profile: { name: "Test Customer" }, wa_id: waId }],
              messages: [
                { from: waId, id: providerMessageId, timestamp: `${Math.floor(Date.now() / 1000)}`, type: "text", text: { body } },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("processInboundWhatsAppPayload", () => {
  it("creates a new customer, an ACTIVE conversation, and a persisted message on first contact", async () => {
    const waId = `wa-${randomUUID()}`;
    const providerMessageId = `wamid.${randomUUID()}`;

    await processInboundWhatsAppPayload(textMessagePayload(waId, providerMessageId, "Olá, quero saber mais"));

    const matches = await findIdentityMatches([{ type: "whatsapp", value: waId }]);
    expect(matches).toHaveLength(1);
    const customerId = matches[0]!.customerId;

    const conversation = await getOrCreateActiveConversation(customerId);
    expect(conversation.status).toBe("ACTIVE");

    const messages = await getMessagesForConversation(conversation.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.bodyText).toBe("Olá, quero saber mais");
    expect(messages[0]?.providerMessageId).toBe(providerMessageId);
  });

  it("is idempotent: reprocessing the same webhook payload does not duplicate the message", async () => {
    const waId = `wa-${randomUUID()}`;
    const providerMessageId = `wamid.${randomUUID()}`;
    const payload = textMessagePayload(waId, providerMessageId, "Mensagem única");

    await processInboundWhatsAppPayload(payload);
    await processInboundWhatsAppPayload(payload); // simulate Meta's at-least-once redelivery

    const matches = await findIdentityMatches([{ type: "whatsapp", value: waId }]);
    const conversation = await getOrCreateActiveConversation(matches[0]!.customerId);
    const messages = await getMessagesForConversation(conversation.id);
    expect(messages).toHaveLength(1);
  });

  it("reuses the existing conversation across multiple messages from the same customer", async () => {
    const waId = `wa-${randomUUID()}`;
    await processInboundWhatsAppPayload(textMessagePayload(waId, `wamid.${randomUUID()}`, "Primeira mensagem"));
    await processInboundWhatsAppPayload(textMessagePayload(waId, `wamid.${randomUUID()}`, "Segunda mensagem"));

    const matches = await findIdentityMatches([{ type: "whatsapp", value: waId }]);
    const conversation = await getOrCreateActiveConversation(matches[0]!.customerId);
    const messages = await getMessagesForConversation(conversation.id);
    expect(messages).toHaveLength(2);
  });

  it("revokes marketing consent on an opt-out keyword", async () => {
    const waId = `wa-${randomUUID()}`;
    // Create the customer with marketing consent granted first, as if from an earlier opt-in.
    const providerMessageId1 = `wamid.${randomUUID()}`;
    await processInboundWhatsAppPayload(textMessagePayload(waId, providerMessageId1, "Oi"));
    const matches = await findIdentityMatches([{ type: "whatsapp", value: waId }]);
    const customerId = matches[0]!.customerId;
    await grantConsentSystem(customerId, "marketing", "whatsapp-opt-in-test-setup");
    expect(await isConsentGranted(customerId, "marketing")).toBe(true);

    await processInboundWhatsAppPayload(textMessagePayload(waId, `wamid.${randomUUID()}`, "PARAR"));

    expect(await isConsentGranted(customerId, "marketing")).toBe(false);
  });

  it("processes a status update without throwing, even for an unknown message id", async () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: { statuses: [{ id: "wamid.unknown", status: "delivered", timestamp: "1700000000" }] },
            },
          ],
        },
      ],
    };
    await expect(processInboundWhatsAppPayload(payload)).resolves.not.toThrow();
  });
});
