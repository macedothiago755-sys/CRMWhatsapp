import { and, eq, inArray } from "drizzle-orm";
import { crmSchema, getDb } from "@polar/database";
import { polarError, writeAuditLog, type AuthenticatedActor } from "@polar/security";
import { normalizeEmail, normalizePhone, type IdentityType } from "./identity.js";

/**
 * Customer read/write — see docs/architecture/domain-model.md §"Entity
 * responsibilities" and docs/architecture/adr/ADR-0011-immutable-internal-customer-id.md.
 * `crm.customer.id` is the only cross-context key; everything here treats
 * phone/email/wa_id as attached identities, never as the row's identity.
 */

export interface CustomerRecord {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentityInput {
  type: IdentityType;
  value: string;
}

function normalizeIdentity(input: IdentityInput): IdentityInput {
  switch (input.type) {
    case "phone":
    case "whatsapp":
      return { type: input.type, value: normalizePhone(input.value) };
    case "email":
      return { type: input.type, value: normalizeEmail(input.value) };
    default:
      return input;
  }
}

/** Creates a brand-new customer with one or more identities already attached. */
export async function createCustomer(identities: IdentityInput[]): Promise<CustomerRecord> {
  if (identities.length === 0) {
    throw polarError("VALIDATION_ERROR", "A new customer requires at least one identity.");
  }

  const db = getDb();
  const normalized = identities.map(normalizeIdentity);

  return db.transaction(async (tx) => {
    const [customer] = await tx.insert(crmSchema.customer).values({}).returning();
    if (!customer) {
      throw polarError("INTERNAL_ERROR", "Failed to create customer.");
    }

    await tx.insert(crmSchema.customerIdentity).values(
      normalized.map((identity, index) => ({
        customerId: customer.id,
        identityType: identity.type,
        identityValue: identity.value,
        isPrimary: index === 0,
      })),
    );

    return customer;
  });
}

export async function getCustomerById(customerId: string): Promise<CustomerRecord> {
  const db = getDb();
  const [customer] = await db
    .select()
    .from(crmSchema.customer)
    .where(eq(crmSchema.customer.id, customerId))
    .limit(1);

  if (!customer) {
    throw polarError("CUSTOMER_NOT_FOUND", `Customer ${customerId} not found.`);
  }
  return customer;
}

export async function findIdentityMatches(
  identities: IdentityInput[],
): Promise<{ customerId: string; identityType: IdentityType; identityValue: string }[]> {
  if (identities.length === 0) return [];

  const db = getDb();
  const normalized = identities.map(normalizeIdentity);

  const rows = await db
    .select({
      customerId: crmSchema.customerIdentity.customerId,
      identityType: crmSchema.customerIdentity.identityType,
      identityValue: crmSchema.customerIdentity.identityValue,
    })
    .from(crmSchema.customerIdentity)
    .where(
      inArray(
        crmSchema.customerIdentity.identityValue,
        normalized.map((i) => i.value),
      ),
    );

  // Only keep rows whose (type, value) pair was actually requested — inArray
  // above only narrows by value, since a composite IN isn't portable via Drizzle
  // core without a raw fragment.
  const requested = new Set(normalized.map((i) => `${i.type}:${i.value}`));
  return rows
    .filter((r) => requested.has(`${r.identityType}:${r.identityValue}`))
    .map((r) => ({ ...r, identityType: r.identityType as IdentityType }));
}

export async function linkIdentity(customerId: string, identity: IdentityInput): Promise<void> {
  const db = getDb();
  const normalized = normalizeIdentity(identity);

  const existing = await db
    .select({ id: crmSchema.customerIdentity.id })
    .from(crmSchema.customerIdentity)
    .where(
      and(
        eq(crmSchema.customerIdentity.identityType, normalized.type),
        eq(crmSchema.customerIdentity.identityValue, normalized.value),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return; // already linked (to this customer or another — resolution is the caller's job)
  }

  await db.insert(crmSchema.customerIdentity).values({
    customerId,
    identityType: normalized.type,
    identityValue: normalized.value,
  });
}

export async function softDeleteCustomer(customerId: string, actor: AuthenticatedActor): Promise<void> {
  const db = getDb();
  const before = await getCustomerById(customerId);

  await db
    .update(crmSchema.customer)
    .set({ status: "blocked", deletedAt: new Date() })
    .where(eq(crmSchema.customer.id, customerId));

  await writeAuditLog({
    actorUserId: actor.userId,
    actorType: "human",
    action: "customer.deleted",
    entityType: "customer",
    entityId: customerId,
    before: { status: before.status, deletedAt: null },
    after: { status: "blocked", deletedAt: new Date().toISOString() },
  });
}
