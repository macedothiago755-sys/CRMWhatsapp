import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "@polar/database";
import { createCustomer } from "@polar/crm";
import {
  getConversation,
  getMessagesForConversation,
  getOrCreateActiveConversation,
  recordInboundMessage,
  recordOutboundMessage,
  transitionConversation,
  updateMessageStatusByProviderId,
} from "@polar/conversation";
import { uniquePhone } from "../helpers.js";

afterAll(async () => {
  await closePool();
});

describe("conversationService", () => {
  it("creates a NEW conversation for a customer with none, then reuses it", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    const first = await getOrCreateActiveConversation(customer.id);
    expect(first.status).toBe("NEW");

    const second = await getOrCreateActiveConversation(customer.id);
    expect(second.id).toBe(first.id);
  });

  it("starts a new conversation once the previous one reaches a terminal state", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);
    const first = await getOrCreateActiveConversation(customer.id);
    await transitionConversation(first.id, "ACTIVE");
    await transitionConversation(first.id, "RESOLVED");

    const second = await getOrCreateActiveConversation(customer.id);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe("NEW");
  });

  it("rejects an invalid transition", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);
    const conversation = await getOrCreateActiveConversation(customer.id);

    await expect(transitionConversation(conversation.id, "CHECKOUT")).rejects.toThrow();
  });

  it("returns null for an unknown conversation id", async () => {
    expect(await getConversation("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("messageService", () => {
  it("persists an inbound message and dedupes a redelivery by provider_message_id", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);
    const conversation = await getOrCreateActiveConversation(customer.id);
    const providerMessageId = `wamid.${crypto.randomUUID()}`;

    const first = await recordInboundMessage({
      conversationId: conversation.id,
      customerId: customer.id,
      providerMessageId,
      messageType: "text",
      bodyText: "Olá",
    });
    expect(first.deduped).toBe(false);

    const redelivered = await recordInboundMessage({
      conversationId: conversation.id,
      customerId: customer.id,
      providerMessageId,
      messageType: "text",
      bodyText: "Olá",
    });
    expect(redelivered.deduped).toBe(true);
    expect(redelivered.message.id).toBe(first.message.id);

    const messages = await getMessagesForConversation(conversation.id);
    expect(messages).toHaveLength(1);
  });

  it("records an outbound message", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);
    const conversation = await getOrCreateActiveConversation(customer.id);

    const outbound = await recordOutboundMessage({
      conversationId: conversation.id,
      customerId: customer.id,
      providerMessageId: `wamid.${crypto.randomUUID()}`,
      messageType: "text",
      bodyText: "Olá, como posso ajudar?",
    });

    expect(outbound?.direction).toBe("outbound");
    expect(outbound?.status).toBe("sent");
  });

  it("applies a valid status transition and ignores an unknown message id", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);
    const conversation = await getOrCreateActiveConversation(customer.id);
    const providerMessageId = `wamid.${crypto.randomUUID()}`;

    await recordOutboundMessage({
      conversationId: conversation.id,
      customerId: customer.id,
      providerMessageId,
      messageType: "text",
      bodyText: "hi",
    });

    expect(await updateMessageStatusByProviderId(providerMessageId, "delivered")).toBe(true);
    expect(await updateMessageStatusByProviderId(providerMessageId, "read")).toBe(true);
    // "sent" is not a valid transition from "read" — ignored, not an error.
    expect(await updateMessageStatusByProviderId(providerMessageId, "sent")).toBe(false);
    expect(await updateMessageStatusByProviderId("wamid.does-not-exist", "read")).toBe(false);
  });
});
