import { describe, expect, it } from "vitest";
import { normalizeInboundPayload, type RawWebhookPayload } from "@polar/whatsapp";

function textMessagePayload(overrides: Partial<Record<string, unknown>> = {}): RawWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-123",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "5511999990000", phone_number_id: "pn-1" },
              contacts: [{ profile: { name: "Ana" }, wa_id: "5511988887777" }],
              messages: [
                {
                  from: "5511988887777",
                  id: "wamid.ABC123",
                  timestamp: "1700000000",
                  type: "text",
                  text: { body: "Olá, quero saber sobre o relógio de corrida" },
                  ...overrides,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("normalizeInboundPayload", () => {
  it("extracts a normalized text message with contact name and phone_number_id", () => {
    const result = normalizeInboundPayload(textMessagePayload());
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({
      waId: "5511988887777",
      providerMessageId: "wamid.ABC123",
      messageType: "text",
      bodyText: "Olá, quero saber sobre o relógio de corrida",
      contactName: "Ana",
      phoneNumberId: "pn-1",
    });
    expect(result.statuses).toHaveLength(0);
  });

  it("normalizes an unrecognized message type to 'unknown' without dropping it", () => {
    const result = normalizeInboundPayload(textMessagePayload({ type: "unsupported_future_type" }));
    expect(result.messages[0]?.messageType).toBe("unknown");
  });

  it("skips a message missing 'from' or 'id' instead of throwing", () => {
    const payload = textMessagePayload({ from: undefined });
    const result = normalizeInboundPayload(payload);
    expect(result.messages).toHaveLength(0);
  });

  it("extracts a status update", () => {
    const payload: RawWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                statuses: [
                  { id: "wamid.ABC123", status: "delivered", timestamp: "1700000100", recipient_id: "5511988887777" },
                ],
              },
            },
          ],
        },
      ],
    };
    const result = normalizeInboundPayload(payload);
    expect(result.statuses).toHaveLength(1);
    expect(result.statuses[0]).toMatchObject({
      providerMessageId: "wamid.ABC123",
      status: "delivered",
      recipientWaId: "5511988887777",
    });
  });

  it("ignores a change whose field is not 'messages'", () => {
    const payload: RawWebhookPayload = {
      entry: [{ changes: [{ field: "some_other_field", value: { messages: [{ from: "x", id: "y" }] } }] }],
    };
    expect(normalizeInboundPayload(payload)).toEqual({ messages: [], statuses: [] });
  });

  it("handles a completely empty payload gracefully", () => {
    expect(normalizeInboundPayload({})).toEqual({ messages: [], statuses: [] });
  });
});
