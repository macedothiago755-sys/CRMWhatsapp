import { eq } from "drizzle-orm";
import { crmSchema, getDb } from "@polar/database";
import { writeAuditLog, type AuthenticatedActor } from "@polar/security";
import { getCustomerById } from "./customerService.js";
import { getConsentStatus } from "./consentService.js";
import { getCurrentPreferences } from "./preferenceService.js";
import { getSportProfiles } from "./profileService.js";
import { getTimeline } from "./timelineService.js";

/**
 * LGPD data-subject rights — see docs/security/security-architecture.md §7 and
 * master prompt §40:
 *   export_customer_data() / delete_customer_data() / anonymize_customer() /
 *   get_consent_status() / revoke_consent()
 *
 * get_consent_status / revoke_consent live in ./consentService.ts.
 *
 * IMPORTANT: this does not implement a full cross-schema physical purge of
 * message/event history. Retention windows per data category are a pending
 * Product Owner decision (docs/security/security-architecture.md §8) — until
 * that's set, "delete" here means the erasure this repo *can* responsibly
 * perform today (anonymize personal fields, revoke consent, soft-delete the
 * customer row) rather than an irreversible purge whose scope hasn't been
 * decided. Extend this once retention policy lands (see docs/architecture/roadmap.md).
 */

export interface CustomerDataExport {
  customer: Awaited<ReturnType<typeof getCustomerById>>;
  profile: unknown;
  sportProfiles: unknown;
  identities: unknown;
  preferences: unknown;
  consents: unknown;
  timeline: unknown;
  exportedAt: string;
}

export async function exportCustomerData(customerId: string): Promise<CustomerDataExport> {
  const db = getDb();
  const [customer, profile, sportProfiles, identities, preferences, consents, timeline] = await Promise.all([
    getCustomerById(customerId),
    db.select().from(crmSchema.customerProfile).where(eq(crmSchema.customerProfile.customerId, customerId)),
    getSportProfiles(customerId),
    db
      .select({
        identityType: crmSchema.customerIdentity.identityType,
        identityValue: crmSchema.customerIdentity.identityValue,
        isPrimary: crmSchema.customerIdentity.isPrimary,
      })
      .from(crmSchema.customerIdentity)
      .where(eq(crmSchema.customerIdentity.customerId, customerId)),
    getCurrentPreferences(customerId),
    getConsentStatus(customerId),
    getTimeline(customerId, 1000),
  ]);

  return {
    customer,
    profile: profile[0] ?? null,
    sportProfiles,
    identities,
    preferences,
    consents,
    timeline,
    exportedAt: new Date().toISOString(),
  };
}

const ANONYMIZED_MARKER = "[ANONYMIZED]";

export async function anonymizeCustomer(customerId: string, actor: AuthenticatedActor): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(crmSchema.customerProfile)
      .set({
        firstName: ANONYMIZED_MARKER,
        lastName: ANONYMIZED_MARKER,
        birthDate: null,
        city: null,
        state: null,
        updatedAt: new Date(),
      })
      .where(eq(crmSchema.customerProfile.customerId, customerId));

    // Identities are the customer's contact points — anonymizing in place
    // (rather than deleting) preserves referential integrity for existing
    // conversations/orders while destroying the reachable PII value.
    const identities = await tx
      .select({ id: crmSchema.customerIdentity.id, identityType: crmSchema.customerIdentity.identityType })
      .from(crmSchema.customerIdentity)
      .where(eq(crmSchema.customerIdentity.customerId, customerId));

    for (const identity of identities) {
      await tx
        .update(crmSchema.customerIdentity)
        .set({ identityValue: `anonymized:${identity.id}`, updatedAt: new Date() })
        .where(eq(crmSchema.customerIdentity.id, identity.id));
    }

    await tx
      .update(crmSchema.customer)
      .set({ status: "blocked", updatedAt: new Date() })
      .where(eq(crmSchema.customer.id, customerId));
  });

  await writeAuditLog({
    actorUserId: actor.userId,
    actorType: "human",
    action: "customer.anonymized",
    entityType: "customer",
    entityId: customerId,
  });
}

export async function deleteCustomerData(customerId: string, actor: AuthenticatedActor): Promise<void> {
  await anonymizeCustomer(customerId, actor);

  const db = getDb();
  await db
    .update(crmSchema.customer)
    .set({ deletedAt: new Date() })
    .where(eq(crmSchema.customer.id, customerId));

  await writeAuditLog({
    actorUserId: actor.userId,
    actorType: "human",
    action: "customer.deletion_requested",
    entityType: "customer",
    entityId: customerId,
    metadata: {
      note: "Personal fields anonymized and customer soft-deleted. Full cross-schema purge pending retention policy — see docs/security/security-architecture.md §8.",
    },
  });
}
