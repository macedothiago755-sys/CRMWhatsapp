import { describe, expect, it } from "vitest";
import {
  canClaimPaymentSuccess,
  canOfferCampaign,
  canSellProduct,
  canSendMarketingMessage,
  isDiscountAllowed,
  requiresIdentityVerification,
} from "@polar/commerce";

describe("canSellProduct", () => {
  it("refuses to sell when stock is unavailable", () => {
    expect(canSellProduct({ stockAvailable: false, stockQuantity: null, snapshotAgeMs: 0 })).toBe(false);
  });

  it("refuses to sell when quantity is zero", () => {
    expect(canSellProduct({ stockAvailable: true, stockQuantity: 0, snapshotAgeMs: 0 })).toBe(false);
  });

  it("refuses to sell on a stale snapshot even if stock looks available", () => {
    expect(
      canSellProduct({ stockAvailable: true, stockQuantity: 10, snapshotAgeMs: 10 * 60 * 1000 }),
    ).toBe(false);
  });

  it("allows the sale for fresh, available stock", () => {
    expect(canSellProduct({ stockAvailable: true, stockQuantity: 10, snapshotAgeMs: 1000 })).toBe(true);
  });
});

describe("canOfferCampaign", () => {
  it("only offers a running campaign", () => {
    expect(canOfferCampaign({ campaignStatus: "running" })).toBe(true);
    expect(canOfferCampaign({ campaignStatus: "draft" })).toBe(false);
    expect(canOfferCampaign({ campaignStatus: "completed" })).toBe(false);
  });
});

describe("isDiscountAllowed", () => {
  it("denies a negative discount", () => {
    expect(isDiscountAllowed(-5, 20)).toBe(false);
  });

  it("denies a discount exceeding the configured maximum", () => {
    expect(isDiscountAllowed(25, 20)).toBe(false);
  });

  it("allows a discount within the configured maximum", () => {
    expect(isDiscountAllowed(15, 20)).toBe(true);
  });
});

describe("canSendMarketingMessage", () => {
  it("requires explicit consent", () => {
    expect(canSendMarketingMessage(false)).toBe(false);
    expect(canSendMarketingMessage(true)).toBe(true);
  });
});

describe("requiresIdentityVerification", () => {
  it("requires verification unless the identity is a confident match", () => {
    expect(requiresIdentityVerification({ outcome: "matched" })).toBe(false);
    expect(requiresIdentityVerification({ outcome: "ambiguous" })).toBe(true);
    expect(requiresIdentityVerification({ outcome: "no_match" })).toBe(true);
  });
});

describe("canClaimPaymentSuccess", () => {
  it("only claims success for an approved payment", () => {
    expect(canClaimPaymentSuccess("approved")).toBe(true);
    expect(canClaimPaymentSuccess("pending")).toBe(false);
    expect(canClaimPaymentSuccess("unknown")).toBe(false);
    expect(canClaimPaymentSuccess("denied")).toBe(false);
  });
});
