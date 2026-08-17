export {
  type ProductSnapshot,
  PRODUCT_SNAPSHOT_FRESHNESS_MS,
  canSellProduct,
  type CampaignEligibility,
  canOfferCampaign,
  isDiscountAllowed,
  canSendMarketingMessage,
  type IdentityConfidence,
  requiresIdentityVerification,
  type PaymentStatus,
  canClaimPaymentSuccess,
} from "./businessRules.js";
