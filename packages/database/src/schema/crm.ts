/**
 * Drizzle typed schema — `crm` bounded context.
 *
 * This mirrors a subset of database/migrations/0001_init.sql. The SQL migration is
 * the canonical schema (docs/architecture/data-architecture.md §2); table
 * definitions are added here incrementally as each context's read/write code is
 * built, not all at once, to avoid a typed layer drifting ahead of implemented
 * behavior. See docs/architecture/adr/ADR-0008-api-and-tooling-stack.md.
 */
import {
  boolean,
  date,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const crm = pgSchema("crm");

export const customer = crm.table("customer", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("active"),
  mergedIntoCustomerId: uuid("merged_into_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const customerIdentity = crm.table("customer_identity", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  identityType: text("identity_type").notNull(), // whatsapp | phone | email | vtex_customer_id | external
  identityValue: text("identity_value").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerPreference = crm.table("customer_preference", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  attribute: text("attribute").notNull(),
  value: text("value").notNull(),
  confidence: numeric("confidence"),
  source: text("source").notNull(), // explicit | inferred | imported
  sourceConversationId: uuid("source_conversation_id"),
  sourceMessageId: uuid("source_message_id"),
  isCurrent: boolean("is_current").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const customerProfile = crm.table("customer_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .unique()
    .references(() => customer.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  birthDate: date("birth_date"),
  gender: text("gender"),
  locale: text("locale").default("pt-BR"),
  country: text("country").default("BR"),
  state: text("state"),
  city: text("city"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerSportProfile = crm.table("customer_sport_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  sport: text("sport").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  level: text("level"),
  frequency: text("frequency"),
  goal: text("goal"),
  experience: text("experience"),
  distanceKm: numeric("distance_km"),
  routine: text("routine"),
  source: text("source").notNull().default("inferred"), // explicit | inferred | imported
  confidence: numeric("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerSegment = crm.table("customer_segment", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  definition: jsonb("definition"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerSegmentMembership = crm.table("customer_segment_membership", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  segmentId: uuid("segment_id")
    .notNull()
    .references(() => customerSegment.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
});

export const customerTag = crm.table("customer_tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerTimeline = crm.table("customer_timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  title: text("title").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerMergeCandidate = crm.table("customer_merge_candidate", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateCustomerIds: uuid("candidate_customer_ids").array().notNull(),
  matchedIdentityType: text("matched_identity_type").notNull(),
  matchedIdentityValue: text("matched_identity_value").notNull(),
  status: text("status").notNull().default("pending"), // pending | merged | rejected
  resolvedBy: uuid("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
