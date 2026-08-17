import { describe, expect, it } from "vitest";
import { canSendCampaignDelivery, type CampaignSendCheckInput } from "@polar/campaigns";

const baseInput: CampaignSendCheckInput = {
  marketingConsentGranted: true,
  templateStatus: "approved",
  customerOptedOut: false,
  sendsToThisCustomerInWindow: 0,
  maxSendsPerWindow: 3,
};

describe("canSendCampaignDelivery", () => {
  it("allows a send when all conditions are satisfied", () => {
    expect(canSendCampaignDelivery(baseInput)).toEqual({ allowed: true });
  });

  it("denies when the customer opted out, even with consent", () => {
    expect(
      canSendCampaignDelivery({ ...baseInput, customerOptedOut: true }),
    ).toEqual({ allowed: false, reason: "OPTED_OUT" });
  });

  it("denies without marketing consent", () => {
    expect(
      canSendCampaignDelivery({ ...baseInput, marketingConsentGranted: false }),
    ).toEqual({ allowed: false, reason: "NO_CONSENT" });
  });

  it("denies when the template is not approved", () => {
    expect(
      canSendCampaignDelivery({ ...baseInput, templateStatus: "pending_approval" }),
    ).toEqual({ allowed: false, reason: "TEMPLATE_NOT_APPROVED" });
  });

  it("denies once the frequency limit is reached", () => {
    expect(
      canSendCampaignDelivery({ ...baseInput, sendsToThisCustomerInWindow: 3, maxSendsPerWindow: 3 }),
    ).toEqual({ allowed: false, reason: "FREQUENCY_LIMIT_EXCEEDED" });
  });
});
