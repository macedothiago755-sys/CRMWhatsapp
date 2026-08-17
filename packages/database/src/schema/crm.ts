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
