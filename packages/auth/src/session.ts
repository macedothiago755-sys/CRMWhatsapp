import type { AuthenticatedActor } from "@polar/security";

/**
 * Admin application session contract — see docs/security/security-architecture.md §1.
 * Sessions are short-lived, refreshable, and revocable server-side. The concrete
 * store (e.g. Redis-backed) is implemented in Phase 2 alongside the admin app.
 */
export interface Session {
  sessionId: string;
  actor: AuthenticatedActor;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionStore {
  create(actor: AuthenticatedActor, ttlSeconds: number): Promise<Session>;
  get(sessionId: string): Promise<Session | null>;
  revoke(sessionId: string): Promise<void>;
}

export function isSessionExpired(session: Session, now: Date = new Date()): boolean {
  return now.getTime() >= session.expiresAt.getTime();
}
