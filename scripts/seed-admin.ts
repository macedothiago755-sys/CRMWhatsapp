#!/usr/bin/env tsx
/**
 * Local/dev-only helper: creates a SUPER_ADMIN app_user for manual smoke testing.
 * Not for production use — real admin provisioning is a Phase 2 admin-app concern.
 * Usage: tsx scripts/seed-admin.ts <email> <password>
 */
import { eq } from "drizzle-orm";
import { getDb, securitySchema, closePool } from "@polar/database";
import { hashPassword } from "@polar/security";

async function main(): Promise<void> {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Usage: tsx scripts/seed-admin.ts <email> <password>");
    process.exit(1);
  }

  const db = getDb();
  const passwordHash = await hashPassword(password);

  const [role] = await db.select().from(securitySchema.role).where(eq(securitySchema.role.key, "SUPER_ADMIN")).limit(1);
  if (!role) {
    throw new Error("SUPER_ADMIN role not found — run migrations first.");
  }

  const [user] = await db
    .insert(securitySchema.appUser)
    .values({ email: email.toLowerCase(), name: "Seed Admin", passwordHash })
    .returning();
  if (!user) throw new Error("Failed to create user.");

  await db.insert(securitySchema.userRole).values({ userId: user.id, roleId: role.id });

  console.log(`Created SUPER_ADMIN user ${user.email} (${user.id})`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
