import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "@polar/database";
import { createCustomer, resolveOrCreateCustomer } from "@polar/crm";
import { uniquePhone } from "../helpers.js";

afterAll(async () => {
  await closePool();
});

describe("resolveOrCreateCustomer", () => {
  it("creates a new customer when no identity matches", async () => {
    const result = await resolveOrCreateCustomer([{ type: "phone", value: uniquePhone() }]);
    expect(result.outcome).toBe("created");
  });

  it("matches an existing customer by whatsapp id and links a new email identity", async () => {
    const waId = `wa-${randomUUID()}`;
    const customer = await createCustomer([{ type: "whatsapp", value: waId }]);

    const email = `customer-${randomUUID()}@example.com`;
    const result = await resolveOrCreateCustomer([
      { type: "whatsapp", value: waId },
      { type: "email", value: email },
    ]);

    expect(result).toEqual({ outcome: "matched", customerId: customer.id });
  });

  it("prefers the higher-priority identity type (whatsapp) when it disagrees with a lower one (email)", async () => {
    const waIdA = `wa-${randomUUID()}`;
    const emailB = `customer-${randomUUID()}@example.com`;

    const customerA = await createCustomer([{ type: "whatsapp", value: waIdA }]);
    await createCustomer([{ type: "email", value: emailB }]);

    const result = await resolveOrCreateCustomer([
      { type: "whatsapp", value: waIdA },
      { type: "email", value: emailB },
    ]);

    // whatsapp outranks email (docs/architecture/domain-model.md §3), so this
    // resolves to customerA rather than being flagged ambiguous.
    expect(result).toEqual({ outcome: "matched", customerId: customerA.id });
  });

  it("records a merge candidate instead of guessing when same-priority identities disagree", async () => {
    const phoneA = uniquePhone();
    const phoneB = uniquePhone();

    const customerA = await createCustomer([{ type: "phone", value: phoneA }]);
    const customerB = await createCustomer([{ type: "phone", value: phoneB }]);

    const result = await resolveOrCreateCustomer([
      { type: "phone", value: phoneA },
      { type: "phone", value: phoneB },
    ]);

    expect(result.outcome).toBe("ambiguous");
    if (result.outcome === "ambiguous") {
      expect(result.candidateCustomerIds.sort()).toEqual([customerA.id, customerB.id].sort());
      expect(result.mergeCandidateId).toBeTruthy();
    }
  });
});
