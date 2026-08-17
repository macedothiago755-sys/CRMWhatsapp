import { getDb, crmSchema } from "@polar/database";
import {
  type IdentityResolution,
  resolveIdentityMatch,
} from "./identity.js";
import { createCustomer, findIdentityMatches, linkIdentity, type IdentityInput } from "./customerService.js";

/**
 * DB-backed identity resolution — wraps the pure matching rules in ./identity.ts
 * with real lookups/writes. See docs/architecture/domain-model.md §3 and
 * docs/architecture/adr/ADR-0011-immutable-internal-customer-id.md.
 *
 * Never auto-merges: an ambiguous result is recorded to
 * crm.customer_merge_candidate for manual review, not resolved silently.
 */
export type IdentityResolutionOutcome =
  | { outcome: "matched"; customerId: string }
  | { outcome: "created"; customerId: string }
  | { outcome: "ambiguous"; mergeCandidateId: string; candidateCustomerIds: string[] };

export async function resolveOrCreateCustomer(
  identities: IdentityInput[],
): Promise<IdentityResolutionOutcome> {
  const matches = await findIdentityMatches(identities);
  const resolution: IdentityResolution = resolveIdentityMatch(matches);

  if (resolution.outcome === "no_match") {
    const customer = await createCustomer(identities);
    return { outcome: "created", customerId: customer.id };
  }

  if (resolution.outcome === "matched") {
    // Attach any of the inbound identities not yet linked to this customer
    // (e.g. a returning WhatsApp customer providing an email for the first time).
    for (const identity of identities) {
      await linkIdentity(resolution.customerId, identity);
    }
    return { outcome: "matched", customerId: resolution.customerId };
  }

  // Ambiguous — record for manual review, do not guess.
  const primary = identities[0];
  if (!primary) {
    throw new Error("resolveOrCreateCustomer requires at least one identity.");
  }
  const db = getDb();
  const [candidate] = await db
    .insert(crmSchema.customerMergeCandidate)
    .values({
      candidateCustomerIds: resolution.candidateCustomerIds,
      matchedIdentityType: primary.type,
      matchedIdentityValue: primary.value,
    })
    .returning();

  if (!candidate) {
    throw new Error("Failed to record merge candidate.");
  }

  return {
    outcome: "ambiguous",
    mergeCandidateId: candidate.id,
    candidateCustomerIds: resolution.candidateCustomerIds,
  };
}
