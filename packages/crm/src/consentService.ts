import { and, eq } from "drizzle-orm";
import { consentSchema, getDb } from "@polar/database";
import { polarError, writeAuditLog, type AuthenticatedActor } from "@polar/security";

/**
 * Consent management — see docs/security/security-architecture.md §7 and
 * master prompt §40. Every state change writes consent.consent_history
 * (append-only) and a security.audit_log entry; current state lives in
 * consent.customer_consent.
 */
const CONSENT_VERSION = "v1"; // bump when the consent copy/terms materially change

async function getPurposeByKey(purposeKey: string) {
  const db = getDb();
  const [purpose] = await db
    .select()
    .from(consentSchema.consentPurpose)
    .where(eq(consentSchema.consentPurpose.key, purposeKey))
    .limit(1);

  if (!purpose) {
    throw polarError("VALIDATION_ERROR", `Unknown consent purpose: ${purposeKey}`);
  }
  return purpose;
}

async function setConsent(
  customerId: string,
  purposeKey: string,
  granted: boolean,
  source: string,
  actor: AuthenticatedActor,
): Promise<void> {
  const db = getDb();
  const purpose = await getPurposeByKey(purposeKey);
  const now = new Date();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: consentSchema.customerConsent.id })
      .from(consentSchema.customerConsent)
      .where(
        and(
          eq(consentSchema.customerConsent.customerId, customerId),
          eq(consentSchema.customerConsent.purposeId, purpose.id),
        ),
      )
      .limit(1);

    const values = {
      granted,
      source,
      version: CONSENT_VERSION,
      grantedAt: granted ? now : undefined,
      revokedAt: granted ? undefined : now,
      updatedAt: now,
    };

    if (existing) {
      await tx
        .update(consentSchema.customerConsent)
        .set(values)
        .where(eq(consentSchema.customerConsent.id, existing.id));
    } else {
      await tx.insert(consentSchema.customerConsent).values({
        customerId,
        purposeId: purpose.id,
        ...values,
      });
    }

    await tx.insert(consentSchema.consentHistory).values({
      customerId,
      purposeId: purpose.id,
      action: granted ? "granted" : "revoked",
      source,
      version: CONSENT_VERSION,
      occurredAt: now,
    });
  });

  await writeAuditLog({
    actorUserId: actor.userId,
    actorType: "human",
    action: granted ? "consent.granted" : "consent.revoked",
    entityType: "customer",
    entityId: customerId,
    after: { purpose: purposeKey, granted, source },
  });
}

export async function grantConsent(
  customerId: string,
  purposeKey: string,
  source: string,
  actor: AuthenticatedActor,
): Promise<void> {
  await setConsent(customerId, purposeKey, true, source, actor);
}

export async function revokeConsent(
  customerId: string,
  purposeKey: string,
  source: string,
  actor: AuthenticatedActor,
): Promise<void> {
  await setConsent(customerId, purposeKey, false, source, actor);
}

export interface ConsentStatus {
  purposeKey: string;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
}

export async function getConsentStatus(customerId: string): Promise<ConsentStatus[]> {
  const db = getDb();
  const rows = await db
    .select({
      purposeKey: consentSchema.consentPurpose.key,
      granted: consentSchema.customerConsent.granted,
      grantedAt: consentSchema.customerConsent.grantedAt,
      revokedAt: consentSchema.customerConsent.revokedAt,
    })
    .from(consentSchema.customerConsent)
    .innerJoin(consentSchema.consentPurpose, eq(consentSchema.customerConsent.purposeId, consentSchema.consentPurpose.id))
    .where(eq(consentSchema.customerConsent.customerId, customerId));

  return rows.map((r) => ({
    purposeKey: r.purposeKey,
    granted: r.granted,
    grantedAt: r.grantedAt,
    revokedAt: r.revokedAt,
  }));
}

/** Is a specific purpose currently granted? Defaults to false (fail closed) if never set. */
export async function isConsentGranted(customerId: string, purposeKey: string): Promise<boolean> {
  const statuses = await getConsentStatus(customerId);
  return statuses.find((s) => s.purposeKey === purposeKey)?.granted ?? false;
}
