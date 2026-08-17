import { eq } from "drizzle-orm";
import { getDb, securitySchema } from "@polar/database";
import { polarError, verifyPassword } from "@polar/security";
import { loadActor } from "./loadActor.js";
import type { Session, SessionStore } from "./session.js";

const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours — short-lived, refreshable (security-architecture.md §1)

export async function login(
  email: string,
  password: string,
  sessionStore: SessionStore,
): Promise<Session> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(securitySchema.appUser)
    .where(eq(securitySchema.appUser.email, email.trim().toLowerCase()))
    .limit(1);

  // Same error for "no such user" and "wrong password" — never reveal which.
  const invalidCredentials = () => polarError("UNAUTHORIZED", "Invalid email or password.");

  if (!user || user.status !== "active" || user.deletedAt || !user.passwordHash) {
    throw invalidCredentials();
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw invalidCredentials();
  }

  const actor = await loadActor(user.id);
  return sessionStore.create(actor, SESSION_TTL_SECONDS);
}
