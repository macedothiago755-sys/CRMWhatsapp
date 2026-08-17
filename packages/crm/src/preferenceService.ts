import { and, desc, eq } from "drizzle-orm";
import { crmSchema, getDb } from "@polar/database";
import { validatePreferenceInput, type CustomerPreferenceInput } from "./preferences.js";

/**
 * Customer preference read/write — see docs/architecture/domain-model.md §4.
 * Preferences are never overwritten in place: the previous current row is
 * flipped to is_current=false and a new row is inserted, so full history
 * (and lineage — source/confidence/conversation/message) is preserved.
 */
export async function setPreference(input: CustomerPreferenceInput) {
  validatePreferenceInput(input);
  const db = getDb();

  return db.transaction(async (tx) => {
    await tx
      .update(crmSchema.customerPreference)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(
        and(
          eq(crmSchema.customerPreference.customerId, input.customerId),
          eq(crmSchema.customerPreference.attribute, input.attribute),
          eq(crmSchema.customerPreference.isCurrent, true),
        ),
      );

    const [created] = await tx
      .insert(crmSchema.customerPreference)
      .values({
        customerId: input.customerId,
        attribute: input.attribute,
        value: input.value,
        confidence: input.confidence !== undefined ? String(input.confidence) : undefined,
        source: input.source,
        sourceConversationId: input.sourceConversationId,
        sourceMessageId: input.sourceMessageId,
        expiresAt: input.expiresAt,
      })
      .returning();

    return created;
  });
}

export async function getCurrentPreferences(customerId: string) {
  const db = getDb();
  return db
    .select()
    .from(crmSchema.customerPreference)
    .where(
      and(
        eq(crmSchema.customerPreference.customerId, customerId),
        eq(crmSchema.customerPreference.isCurrent, true),
      ),
    );
}

export async function getPreferenceHistory(customerId: string, attribute: string) {
  const db = getDb();
  return db
    .select()
    .from(crmSchema.customerPreference)
    .where(
      and(
        eq(crmSchema.customerPreference.customerId, customerId),
        eq(crmSchema.customerPreference.attribute, attribute),
      ),
    )
    .orderBy(desc(crmSchema.customerPreference.createdAt));
}
