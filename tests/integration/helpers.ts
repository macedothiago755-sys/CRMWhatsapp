import { randomUUID } from "node:crypto";
import { getDb, securitySchema } from "@polar/database";
import type { AuthenticatedActor } from "@polar/security";

/**
 * Integration tests exercise real FK constraints (e.g. security.audit_log.actor_user_id
 * → security.app_user.id), so an actor used in an assertion that writes an audit
 * log needs a real app_user row, not just a random UUID.
 */
export async function createTestActor(permissions: AuthenticatedActor["permissions"] = []): Promise<AuthenticatedActor> {
  const db = getDb();
  const [user] = await db
    .insert(securitySchema.appUser)
    .values({ email: `test-${randomUUID()}@example.com`, name: "Test Admin" })
    .returning();

  if (!user) {
    throw new Error("Failed to create test app_user.");
  }

  return { userId: user.id, roles: ["ADMIN"], permissions };
}

export function uniquePhone(): string {
  return `+5511${Math.floor(90000000 + Math.random() * 9000000)}`;
}
