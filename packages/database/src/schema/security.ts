/**
 * Drizzle typed schema — `security` bounded context.
 * See note in ../schema/crm.ts about incremental coverage relative to the SQL migration.
 */
import { boolean, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const security = pgSchema("security");

export const role = security.table("role", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permission = security.table("permission", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermission = security.table("role_permission", {
  roleId: uuid("role_id")
    .notNull()
    .references(() => role.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id")
    .notNull()
    .references(() => permission.id, { onDelete: "cascade" }),
});

export const appUser = security.table("app_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  status: text("status").notNull().default("active"), // active | disabled
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const userRole = security.table("user_role", {
  userId: uuid("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  roleId: uuid("role_id")
    .notNull()
    .references(() => role.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = security.table("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const auditLog = security.table("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id"),
  actorType: text("actor_type").notNull(), // human | system | ai
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
