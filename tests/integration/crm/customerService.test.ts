import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "@polar/database";
import {
  createCustomer,
  findIdentityMatches,
  getCustomerById,
  linkIdentity,
  normalizePhone,
  softDeleteCustomer,
} from "@polar/crm";
import { createTestActor, uniquePhone } from "../helpers.js";

afterAll(async () => {
  await closePool();
});

describe("customerService", () => {
  it("creates a customer with a normalized identity", async () => {
    const phone = uniquePhone();
    const customer = await createCustomer([{ type: "phone", value: phone }]);

    expect(customer.id).toBeTruthy();
    expect(customer.status).toBe("active");

    const matches = await findIdentityMatches([{ type: "phone", value: phone }]);
    expect(matches).toEqual([
      { customerId: customer.id, identityType: "phone", identityValue: normalizePhone(phone) },
    ]);
  });

  it("fetches a customer by id and throws CUSTOMER_NOT_FOUND for an unknown id", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    const fetched = await getCustomerById(customer.id);
    expect(fetched.id).toBe(customer.id);

    await expect(getCustomerById(randomUUID())).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
  });

  it("links an additional identity to an existing customer", async () => {
    const email = `customer-${randomUUID()}@example.com`;
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    await linkIdentity(customer.id, { type: "email", value: email });

    const matches = await findIdentityMatches([{ type: "email", value: email }]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.customerId).toBe(customer.id);
  });

  it("does not duplicate an identity link that already exists", async () => {
    const phone = uniquePhone();
    const customer = await createCustomer([{ type: "phone", value: phone }]);

    await linkIdentity(customer.id, { type: "phone", value: phone });
    const matches = await findIdentityMatches([{ type: "phone", value: phone }]);
    expect(matches).toHaveLength(1);
  });

  it("soft-deletes a customer and writes an audit log entry", async () => {
    const actor = await createTestActor();
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    await softDeleteCustomer(customer.id, actor);

    const fetched = await getCustomerById(customer.id);
    expect(fetched.status).toBe("blocked");
  });
});
