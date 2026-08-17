import { canSendMarketingMessage } from "@polar/commerce";

/**
 * Campaign send guard — see docs/architecture/system-overview.md §"Campaign" and
 * master prompt §53: no campaign is sent without consent, an approved template,
 * frequency rules, and opt-out honored. This is the single deterministic gate a
 * delivery must pass; it is checked per-recipient, not once per campaign.
 */
export interface CampaignSendCheckInput {
  marketingConsentGranted: boolean;
  templateStatus: "pending_approval" | "approved" | "rejected";
  customerOptedOut: boolean;
  sendsToThisCustomerInWindow: number;
  maxSendsPerWindow: number;
}

export type CampaignSendDenialReason =
  | "NO_CONSENT"
  | "TEMPLATE_NOT_APPROVED"
  | "OPTED_OUT"
  | "FREQUENCY_LIMIT_EXCEEDED";

export type CampaignSendCheckResult =
  | { allowed: true }
  | { allowed: false; reason: CampaignSendDenialReason };

export function canSendCampaignDelivery(input: CampaignSendCheckInput): CampaignSendCheckResult {
  if (input.customerOptedOut) {
    return { allowed: false, reason: "OPTED_OUT" };
  }
  if (!canSendMarketingMessage(input.marketingConsentGranted)) {
    return { allowed: false, reason: "NO_CONSENT" };
  }
  if (input.templateStatus !== "approved") {
    return { allowed: false, reason: "TEMPLATE_NOT_APPROVED" };
  }
  if (input.sendsToThisCustomerInWindow >= input.maxSendsPerWindow) {
    return { allowed: false, reason: "FREQUENCY_LIMIT_EXCEEDED" };
  }
  return { allowed: true };
}
