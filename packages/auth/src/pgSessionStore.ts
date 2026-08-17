import { eq } from "drizzle-orm";
import { getDb, securitySchema } from "@polar/database";
import type { AuthenticatedActor } from "@polar/security";
import { loadActor } from "./loadActor.js";
import { isSessionExpired, type Session, type SessionStore } from "./session.js";

/**
 * Postgres-backed session store — short-lived, refreshable, revocable server-side
 * (docs/security/security-architecture.md §1). A Redis-backed implementation of
 * the same `SessionStore` interface can replace this later without touching
 * call sites — see docs/architecture/adr/ADR-0008-api-and-tooling-stack.md on
 * keeping infra swaps isolated behind an interface.
 */
export class PgSessionStore implements SessionStore {
  async create(actor: AuthenticatedActor, ttlSeconds: number): Promise<Session> {
    const db = getDb();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const [row] = await db
      .insert(securitySchema.session)
      .values({ userId: actor.userId, expiresAt })
      .returning();

    if (!row) {
      throw new Error("Failed to create session.");
    }

    return { sessionId: row.id, actor, createdAt: row.createdAt, expiresAt: row.expiresAt };
  }

  async get(sessionId: string): Promise<Session | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(securitySchema.session)
      .where(eq(securitySchema.session.id, sessionId))
      .limit(1);

    if (!row || row.revokedAt) {
      return null;
    }

    const actor = await loadActor(row.userId);
    const session: Session = { sessionId: row.id, actor, createdAt: row.createdAt, expiresAt: row.expiresAt };
    return isSessionExpired(session) ? null : session;
  }

  async revoke(sessionId: string): Promise<void> {
    const db = getDb();
    await db
      .update(securitySchema.session)
      .set({ revokedAt: new Date() })
      .where(eq(securitySchema.session.id, sessionId));
  }
}
