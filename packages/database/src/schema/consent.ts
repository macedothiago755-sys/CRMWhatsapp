/**
 * Drizzle typed schema — `consent` bounded context.
 * See note in ./crm.ts about incremental coverage relative to the SQL migration.
 */
import { boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customer } from "./crm.js";

export const consentSchema = pgSchema("consent");

export const consentPurpose = consentSchema.table("consent_purpose", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  required: boolean("required").notNull().default(false),
});

export const customerConsent = consentSchema.table("customer_consent", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  purposeId: uuid("purpose_id")
    .notNull()
    .references(() => consentPurpose.id),
  granted: boolean("granted").notNull(),
  source: text("source").notNull(),
  version: text("version").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const consentHistory = consentSchema.table("consent_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  purposeId: uuid("purpose_id")
    .notNull()
    .references(() => consentPurpose.id),
  action: text("action").notNull(), // granted | revoked
  source: text("source").notNull(),
  version: text("version").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
