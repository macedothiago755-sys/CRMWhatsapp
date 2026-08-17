import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "@polar/database";
import { appendTimelineEvent, createCustomer, getConsentStatus, getTimeline, grantConsent, isConsentGranted, revokeConsent } from "@polar/crm";
import { createTestActor, uniquePhone } from "../helpers.js";

afterAll(async () => {
  await closePool();
});

describe("timelineService", () => {
  it("appends and lists timeline events, most recent first", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    await appendTimelineEvent({ customerId: customer.id, eventType: "customer.created", title: "Customer created" });
    await appendTimelineEvent({ customerId: customer.id, eventType: "conversation.started", title: "WhatsApp conversation started" });

    const timeline = await getTimeline(customer.id);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.eventType).toBe("conversation.started");
  });
});

describe("consentService", () => {
  it("defaults to not granted for a purpose never set", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);
    expect(await isConsentGranted(customer.id, "marketing")).toBe(false);
  });

  it("grants then revokes consent, updating current state and history", async () => {
    const actor = await createTestActor();
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    await grantConsent(customer.id, "marketing", "whatsapp-opt-in", actor);
    expect(await isConsentGranted(customer.id, "marketing")).toBe(true);

    await revokeConsent(customer.id, "marketing", "customer-request", actor);
    expect(await isConsentGranted(customer.id, "marketing")).toBe(false);

    const status = await getConsentStatus(customer.id);
    const marketing = status.find((s) => s.purposeKey === "marketing");
    expect(marketing?.granted).toBe(false);
    expect(marketing?.revokedAt).toBeTruthy();
  });

  it("rejects an unknown consent purpose", async () => {
    const actor = await createTestActor();
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);
    await expect(grantConsent(customer.id, "not_a_real_purpose", "test", actor)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
