export {
  type IdentityType,
  type ExistingIdentityMatch,
  type IdentityResolution,
  resolveIdentityMatch,
  normalizePhone,
  normalizeEmail,
} from "./identity.js";
export {
  type PreferenceSource,
  type CustomerPreferenceInput,
  validatePreferenceInput,
} from "./preferences.js";

export {
  type CustomerRecord,
  type IdentityInput,
  createCustomer,
  getCustomerById,
  findIdentityMatches,
  linkIdentity,
  softDeleteCustomer,
} from "./customerService.js";
export { type IdentityResolutionOutcome, resolveOrCreateCustomer } from "./identityResolutionService.js";
export {
  type ProfileInput,
  type SportProfileInput,
  upsertProfile,
  upsertSportProfile,
  getSportProfiles,
} from "./profileService.js";
export { setPreference, getCurrentPreferences, getPreferenceHistory } from "./preferenceService.js";
export { type TimelineEventInput, appendTimelineEvent, getTimeline } from "./timelineService.js";
export {
  grantConsent,
  revokeConsent,
  getConsentStatus,
  isConsentGranted,
  type ConsentStatus,
} from "./consentService.js";
export {
  type CustomerDataExport,
  exportCustomerData,
  anonymizeCustomer,
  deleteCustomerData,
} from "./lgpdService.js";
