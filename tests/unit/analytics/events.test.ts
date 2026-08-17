import { describe, expect, it } from "vitest";
import { deriveDedupeKey, isValidEventType, validateEventInput } from "@polar/analytics";

describe("isValidEventType", () => {
  it("accepts <entity>.<past-tense-verb> shaped types", () => {
    expect(isValidEventType("order.created")).toBe(true);
    expect(isValidEventType("campaign.converted")).toBe(true);
  });

  it("rejects malformed event types", () => {
    expect(isValidEventType("OrderCreated")).toBe(false);
    expect(isValidEventType("order")).toBe(false);
    expect(isValidEventType("order.created.extra")).toBe(false);
  });
});

describe("deriveDedupeKey", () => {
  it("is deterministic for the same inputs", () => {
    const a = deriveDedupeKey("whatsapp-webhook", "wamid.123", "message.received");
    const b = deriveDedupeKey("whatsapp-webhook", "wamid.123", "message.received");
    expect(a).toBe(b);
  });

  it("differs when any input differs", () => {
    const a = deriveDedupeKey("whatsapp-webhook", "wamid.123", "message.received");
    const b = deriveDedupeKey("whatsapp-webhook", "wamid.456", "message.received");
    expect(a).not.toBe(b);
  });
});

describe("validateEventInput", () => {
  it("rejects an invalid event type", () => {
    expect(() =>
      validateEventInput({
        eventType: "NotValid",
        dedupeKey: "abc",
        source: "test",
        occurredAt: new Date(),
      }),
    ).toThrow();
  });

  it("rejects a missing dedupe key", () => {
    expect(() =>
      validateEventInput({
        eventType: "order.created",
        dedupeKey: "",
        source: "test",
        occurredAt: new Date(),
      }),
    ).toThrow();
  });

  it("accepts a well-formed event", () => {
    expect(() =>
      validateEventInput({
        eventType: "order.created",
        dedupeKey: "abc123",
        source: "test",
        occurredAt: new Date(),
      }),
    ).not.toThrow();
  });
});
