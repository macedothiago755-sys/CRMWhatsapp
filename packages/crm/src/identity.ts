/**
 * Customer Identity Resolution — see docs/architecture/domain-model.md §3 and
 * docs/architecture/adr/ADR-0011-immutable-internal-customer-id.md.
 *
 * `crm.customer.id` is the only cross-context identity key. Everything here
 * resolves *external* identifiers (WhatsApp ID, phone, email, VTEX customer ID)
 * to that internal id — never the other way around.
 */

export type IdentityType = "whatsapp" | "phone" | "email" | "vtex_customer_id" | "external";

/** Lower number = higher trust when identities disagree. */
const IDENTITY_PRIORITY: Record<IdentityType, number> = {
  whatsapp: 1,
  phone: 2,
  email: 3,
  vtex_customer_id: 4,
  external: 4,
};

export interface ExistingIdentityMatch {
  customerId: string;
  identityType: IdentityType;
  identityValue: string;
}

export type IdentityResolution =
  | { outcome: "no_match" }
  | { outcome: "matched"; customerId: string }
  | { outcome: "ambiguous"; candidateCustomerIds: string[] };

/**
 * Given the set of existing `customer_identity` rows that matched an inbound
 * message's identifiers (e.g. wa_id matched customer A, phone also matched
 * customer A → fine; wa_id matched customer A but email matched customer B →
 * ambiguous), decide the outcome.
 *
 * Never auto-merges. An "ambiguous" result must be routed to a manual merge
 * review (see domain-model.md §3) — it is not resolved automatically here.
 */
export function resolveIdentityMatch(matches: ExistingIdentityMatch[]): IdentityResolution {
  if (matches.length === 0) {
    return { outcome: "no_match" };
  }

  const distinctCustomerIds = [...new Set(matches.map((m) => m.customerId))];
  if (distinctCustomerIds.length === 1) {
    return { outcome: "matched", customerId: distinctCustomerIds[0]! };
  }

  // Multiple distinct customers matched via different identifiers. If a single
  // customer holds the highest-priority identifier present, trust it — but this
  // still leaves the lower-priority identifier's binding inconsistent and worth
  // a review; callers should log that, not silently drop it.
  const topPriority = Math.min(...matches.map((m) => IDENTITY_PRIORITY[m.identityType]));
  const topCustomerIds = [
    ...new Set(matches.filter((m) => IDENTITY_PRIORITY[m.identityType] === topPriority).map((m) => m.customerId)),
  ];

  if (topCustomerIds.length === 1) {
    return { outcome: "matched", customerId: topCustomerIds[0]! };
  }

  return { outcome: "ambiguous", candidateCustomerIds: distinctCustomerIds };
}

/**
 * Normalize a phone number toward E.164. This is a pragmatic implementation for
 * Brazilian numbers (Polar's primary market) — revisit if/when international
 * numbers need first-class support.
 */
export function normalizePhone(raw: string, defaultCountryCode = "55"): string {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Already carries a country code (heuristic: 12-13 digits starting with the
  // default country code, e.g. 55 + DDD + number).
  const alreadyHasCountryCode = digits.startsWith(defaultCountryCode) && digits.length >= 12;

  if (!alreadyHasCountryCode) {
    digits = `${defaultCountryCode}${digits}`;
  }

  return `+${digits}`;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
