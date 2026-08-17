/**
 * Business Rule Engine — deterministic rules the AI calls through tools but never
 * replaces. See docs/architecture/ai-architecture.md §5.
 *
 *   IF stock <= 0                          THEN product cannot be sold
 *   IF campaign inactive                   THEN campaign cannot be offered
 *   IF discount exceeds configured maximum THEN deny
 *   IF marketing consent is false          THEN marketing message cannot be sent
 *   IF customer identity is uncertain      THEN require verification
 *   IF payment status is unknown           THEN never claim payment success
 *
 * Every function here is a pure predicate: no I/O, no side effects, trivially
 * unit-testable, and safe to call from both the pre-generation POLICY CHECK stage
 * and the post-tool-execution RESULT VALIDATION stage of the AI Orchestrator.
 */

export interface ProductSnapshot {
  stockAvailable: boolean;
  stockQuantity: number | null;
  /** Age of this snapshot in milliseconds at evaluation time. */
  snapshotAgeMs: number;
}

/** A snapshot older than this must be re-fetched from VTEX before being trusted. */
export const PRODUCT_SNAPSHOT_FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

export function canSellProduct(snapshot: ProductSnapshot): boolean {
  if (snapshot.snapshotAgeMs > PRODUCT_SNAPSHOT_FRESHNESS_MS) {
    // Stale data must never be used to assert sellability — force a re-check.
    return false;
  }
  if (!snapshot.stockAvailable) {
    return false;
  }
  if (snapshot.stockQuantity !== null && snapshot.stockQuantity <= 0) {
    return false;
  }
  return true;
}

export interface CampaignEligibility {
  campaignStatus: "draft" | "scheduled" | "running" | "completed" | "cancelled";
}

export function canOfferCampaign(campaign: CampaignEligibility): boolean {
  return campaign.campaignStatus === "running";
}

export function isDiscountAllowed(requestedPercent: number, maxAllowedPercent: number): boolean {
  if (requestedPercent < 0) return false;
  return requestedPercent <= maxAllowedPercent;
}

export function canSendMarketingMessage(marketingConsentGranted: boolean): boolean {
  return marketingConsentGranted === true;
}

export interface IdentityConfidence {
  outcome: "matched" | "ambiguous" | "no_match";
}

/** Mirrors crm's IdentityResolution outcomes without importing @polar/crm (keep commerce decoupled). */
export function requiresIdentityVerification(identity: IdentityConfidence): boolean {
  return identity.outcome !== "matched";
}

export type PaymentStatus = "approved" | "denied" | "pending" | "unknown";

/** Never let a response claim success for anything but a confirmed 'approved' status. */
export function canClaimPaymentSuccess(status: PaymentStatus): boolean {
  return status === "approved";
}
