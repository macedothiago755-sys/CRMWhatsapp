import { eq, and } from "drizzle-orm";
import { crmSchema, getDb } from "@polar/database";

/**
 * Customer profile + sport profile — see docs/architecture/domain-model.md §2.
 */
export interface ProfileInput {
  firstName?: string;
  lastName?: string;
  birthDate?: string; // ISO date (YYYY-MM-DD)
  gender?: string;
  locale?: string;
  country?: string;
  state?: string;
  city?: string;
}

export async function upsertProfile(customerId: string, input: ProfileInput) {
  const db = getDb();
  const [existing] = await db
    .select({ id: crmSchema.customerProfile.id })
    .from(crmSchema.customerProfile)
    .where(eq(crmSchema.customerProfile.customerId, customerId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(crmSchema.customerProfile)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(crmSchema.customerProfile.customerId, customerId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(crmSchema.customerProfile)
    .values({ customerId, ...input })
    .returning();
  return created;
}

export interface SportProfileInput {
  sport: string;
  isPrimary?: boolean;
  level?: string;
  frequency?: string;
  goal?: string;
  experience?: string;
  distanceKm?: string;
  routine?: string;
  source: "explicit" | "inferred" | "imported";
  confidence?: number;
}

export async function upsertSportProfile(customerId: string, input: SportProfileInput) {
  const db = getDb();
  const [existing] = await db
    .select({ id: crmSchema.customerSportProfile.id })
    .from(crmSchema.customerSportProfile)
    .where(
      and(
        eq(crmSchema.customerSportProfile.customerId, customerId),
        eq(crmSchema.customerSportProfile.sport, input.sport),
      ),
    )
    .limit(1);

  const values = {
    isPrimary: input.isPrimary ?? false,
    level: input.level,
    frequency: input.frequency,
    goal: input.goal,
    experience: input.experience,
    distanceKm: input.distanceKm,
    routine: input.routine,
    source: input.source,
    confidence: input.confidence !== undefined ? String(input.confidence) : undefined,
  };

  if (existing) {
    const [updated] = await db
      .update(crmSchema.customerSportProfile)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(crmSchema.customerSportProfile.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(crmSchema.customerSportProfile)
    .values({ customerId, sport: input.sport, ...values })
    .returning();
  return created;
}

export async function getSportProfiles(customerId: string) {
  const db = getDb();
  return db
    .select()
    .from(crmSchema.customerSportProfile)
    .where(eq(crmSchema.customerSportProfile.customerId, customerId));
}
