/**
 * Drizzle typed schema — `conversation` bounded context.
 * See note in ./crm.ts about incremental coverage relative to the SQL migration.
 */
import { jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customer } from "./crm.js";

export const conversationSchema = pgSchema("conversation");

export const conversation = conversationSchema.table("conversation", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id),
  channel: text("channel").notNull().default("whatsapp"),
  status: text("status").notNull().default("NEW"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const message = conversationSchema.table("message", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id),
  direction: text("direction").notNull(), // inbound | outbound
  messageType: text("message_type").notNull(),
  providerMessageId: text("provider_message_id"),
  status: text("status").notNull().default("received"),
  bodyText: text("body_text"),
  payload: jsonb("payload").notNull().default({}),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
