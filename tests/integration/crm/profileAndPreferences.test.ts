import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "@polar/database";
import {
  createCustomer,
  getCurrentPreferences,
  getPreferenceHistory,
  getSportProfiles,
  setPreference,
  upsertProfile,
  upsertSportProfile,
} from "@polar/crm";
import { uniquePhone } from "../helpers.js";

afterAll(async () => {
  await closePool();
});

describe("profileService", () => {
  it("creates then updates a customer profile idempotently", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    const created = await upsertProfile(customer.id, { firstName: "Ana", city: "São Paulo" });
    expect(created?.firstName).toBe("Ana");

    const updated = await upsertProfile(customer.id, { firstName: "Ana Paula" });
    expect(updated?.firstName).toBe("Ana Paula");
    expect(updated?.city).toBe("São Paulo"); // untouched fields survive the update
  });

  it("upserts a sport profile per (customer, sport)", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    await upsertSportProfile(customer.id, {
      sport: "running",
      level: "beginner",
      source: "explicit",
    });
    await upsertSportProfile(customer.id, {
      sport: "running",
      level: "intermediate",
      source: "inferred",
      confidence: 0.8,
    });
    await upsertSportProfile(customer.id, { sport: "swimming", level: "beginner", source: "explicit" });

    const profiles = await getSportProfiles(customer.id);
    expect(profiles).toHaveLength(2);
    const running = profiles.find((p) => p.sport === "running");
    expect(running?.level).toBe("intermediate");
  });
});

describe("preferenceService", () => {
  it("keeps only one current row per attribute while preserving history", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    await setPreference({
      customerId: customer.id,
      attribute: "budget_range",
      value: "2000_3000",
      source: "explicit",
    });
    await setPreference({
      customerId: customer.id,
      attribute: "budget_range",
      value: "3000_4000",
      source: "explicit",
    });

    const current = await getCurrentPreferences(customer.id);
    expect(current).toHaveLength(1);
    expect(current[0]?.value).toBe("3000_4000");

    const history = await getPreferenceHistory(customer.id, "budget_range");
    expect(history).toHaveLength(2);
  });

  it("rejects an inferred preference without a confidence score", async () => {
    const customer = await createCustomer([{ type: "phone", value: uniquePhone() }]);

    await expect(
      setPreference({
        customerId: customer.id,
        attribute: "preferred_color",
        value: "black",
        source: "inferred",
      }),
    ).rejects.toThrow();
  });
});
