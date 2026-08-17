import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  resolveIdentityMatch,
  type ExistingIdentityMatch,
} from "@polar/crm";

describe("normalizePhone", () => {
  it("adds the default country code to a local number", () => {
    expect(normalizePhone("(11) 98888-7777")).toBe("+5511988887777");
  });

  it("does not double up an already-present country code", () => {
    expect(normalizePhone("+55 11 98888-7777")).toBe("+5511988887777");
  });

  it("strips a leading 00 international prefix", () => {
    expect(normalizePhone("0055 11 98888-7777")).toBe("+5511988887777");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Customer@Example.COM  ")).toBe("customer@example.com");
  });
});

describe("resolveIdentityMatch", () => {
  it("returns no_match when nothing matched", () => {
    expect(resolveIdentityMatch([])).toEqual({ outcome: "no_match" });
  });

  it("returns matched when all matches point to the same customer", () => {
    const matches: ExistingIdentityMatch[] = [
      { customerId: "cust-1", identityType: "whatsapp", identityValue: "+5511988887777" },
      { customerId: "cust-1", identityType: "phone", identityValue: "+5511988887777" },
    ];
    expect(resolveIdentityMatch(matches)).toEqual({ outcome: "matched", customerId: "cust-1" });
  });

  it("prefers the highest-priority identity type when customers disagree", () => {
    const matches: ExistingIdentityMatch[] = [
      { customerId: "cust-1", identityType: "whatsapp", identityValue: "wa-1" },
      { customerId: "cust-2", identityType: "email", identityValue: "shared@example.com" },
    ];
    expect(resolveIdentityMatch(matches)).toEqual({ outcome: "matched", customerId: "cust-1" });
  });

  it("returns ambiguous when the top-priority tier itself disagrees", () => {
    const matches: ExistingIdentityMatch[] = [
      { customerId: "cust-1", identityType: "whatsapp", identityValue: "wa-1" },
      { customerId: "cust-2", identityType: "whatsapp", identityValue: "wa-2" },
    ];
    const result = resolveIdentityMatch(matches);
    expect(result.outcome).toBe("ambiguous");
    if (result.outcome === "ambiguous") {
      expect(result.candidateCustomerIds.sort()).toEqual(["cust-1", "cust-2"]);
    }
  });
});
