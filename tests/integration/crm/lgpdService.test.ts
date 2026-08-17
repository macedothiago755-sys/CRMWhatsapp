import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "@polar/database";
import {
  anonymizeCustomer,
  createCustomer,
  deleteCustomerData,
  exportCustomerData,
  getCustomerById,
  grantConsent,
  upsertProfile,
} from "@polar/crm";
import { createTestActor, uniquePhone } from "../helpers.js";

afterAll(async () => {
  await closePool();
});

describe("lgpdService", () => {
  it("exports a full snapshot of a customer's data", async () => {
    const actor = await createTestActor();
    const phone = uniquePhone();
    const customer = await createCustomer([{ type: "phone", value: phone }]);
    await upsertProfile(customer.id, { firstName: "Bruno" });
    await grantConsent(customer.id, "marketing", "whatsapp-opt-in", actor);

    const exported = await exportCustomerData(customer.id);
    expect(exported.customer.id).toBe(customer.id);
    expect((exported.profile as { firstName: string } | null)?.firstName).toBe("Bruno");
    expect(exported.identities).toHaveLength(1);
    expect(exported.consents).toHaveLength(1);
  });

  it("anonymizes PII while preserving the customer row for referential integrity", async () => {
    const actor = await createTestActor();
    const phone = uniquePhone();
    const customer = await createCustomer([{ type: "phone", value: phone }]);
    await upsertProfile(customer.id, { firstName: "Carla", city: "Curitiba" });

    await anonymizeCustomer(customer.id, actor);

    const exported = await exportCustomerData(customer.id);
    expect((exported.profile as { firstName: string } | null)?.firstName).toBe("[ANONYMIZED]");
    expect((exported.identities as { identityValue: string }[])[0]?.identityValue).not.toBe(phone);
    expect(exported.customer.status).toBe("blocked");
  });

  it("soft-deletes and anonymizes on a deletion request", async () => {
    const actor = await createTestActor();
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    await deleteCustomerData(customer.id, actor);

    const fetched = await getCustomerById(customer.id);
    expect(fetched.status).toBe("blocked");
  });
});
