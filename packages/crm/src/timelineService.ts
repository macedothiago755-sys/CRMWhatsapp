import { desc, eq } from "drizzle-orm";
import { crmSchema, getDb } from "@polar/database";

/**
 * Customer timeline — append-only read model. See docs/architecture/domain-model.md §2.
 */
export interface TimelineEventInput {
  customerId: string;
  eventType: string;
  title: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export async function appendTimelineEvent(input: TimelineEventInput) {
  const db = getDb();
  const [created] = await db
    .insert(crmSchema.customerTimeline)
    .values({
      customerId: input.customerId,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      occurredAt: input.occurredAt ?? new Date(),
    })
    .returning();
  return created;
}

export async function getTimeline(customerId: string, limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(crmSchema.customerTimeline)
    .where(eq(crmSchema.customerTimeline.customerId, customerId))
    .orderBy(desc(crmSchema.customerTimeline.occurredAt))
    .limit(limit);
}
