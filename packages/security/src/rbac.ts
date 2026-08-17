/**
 * RBAC types — see docs/security/security-architecture.md §2.
 * The catalog here is the typed contract; the actual role/permission rows and
 * assignments live in security.role / security.permission / security.role_permission
 * / security.user_role (database/migrations/0001_init.sql).
 */
import { polarError } from "./errors.js";

export const ROLE_KEYS = [
  "SUPER_ADMIN",
  "ADMIN",
  "MARKETING",
  "CRM_MANAGER",
  "CUSTOMER_SERVICE",
  "ANALYST",
  "VIEWER",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSION_KEYS = [
  "customer.read",
  "customer.write",
  "customer.delete",
  "conversation.read",
  "conversation.manage",
  "campaign.create",
  "campaign.send",
  "ai.prompt.read",
  "ai.prompt.write",
  "knowledge.publish",
  "analytics.read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface AuthenticatedActor {
  userId: string;
  roles: RoleKey[];
  permissions: PermissionKey[];
}

export function hasPermission(actor: AuthenticatedActor, permission: PermissionKey): boolean {
  return actor.permissions.includes(permission);
}

export function requirePermission(actor: AuthenticatedActor, permission: PermissionKey): void {
  if (!hasPermission(actor, permission)) {
    throw polarError("FORBIDDEN", `Actor ${actor.userId} lacks permission ${permission}`, {
      userId: actor.userId,
      permission,
    });
  }
}
