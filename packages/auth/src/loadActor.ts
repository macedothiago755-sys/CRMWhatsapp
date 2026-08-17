import { eq } from "drizzle-orm";
import { getDb, securitySchema } from "@polar/database";
import type { AuthenticatedActor, PermissionKey, RoleKey } from "@polar/security";

/**
 * Resolves a user's full RBAC actor (roles + flattened permission set) from
 * security.user_role / security.role_permission. See
 * docs/security/security-architecture.md §2.
 */
export async function loadActor(userId: string): Promise<AuthenticatedActor> {
  const db = getDb();

  const roleRows = await db
    .select({ key: securitySchema.role.key })
    .from(securitySchema.userRole)
    .innerJoin(securitySchema.role, eq(securitySchema.userRole.roleId, securitySchema.role.id))
    .where(eq(securitySchema.userRole.userId, userId));

  const permissionRows = await db
    .select({ key: securitySchema.permission.key })
    .from(securitySchema.userRole)
    .innerJoin(securitySchema.rolePermission, eq(securitySchema.userRole.roleId, securitySchema.rolePermission.roleId))
    .innerJoin(securitySchema.permission, eq(securitySchema.rolePermission.permissionId, securitySchema.permission.id))
    .where(eq(securitySchema.userRole.userId, userId));

  return {
    userId,
    roles: [...new Set(roleRows.map((r) => r.key as RoleKey))],
    permissions: [...new Set(permissionRows.map((p) => p.key as PermissionKey))],
  };
}
