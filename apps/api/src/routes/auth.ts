import type { FastifyInstance } from "fastify";
import { login } from "@polar/auth";
import { polarError } from "@polar/security";

interface LoginBody {
  email: string;
  password: string;
}

/**
 * Admin authentication — see docs/security/security-architecture.md §1.
 * Sessions are opaque, server-side, revocable (security.session), presented
 * as a Bearer token — see apps/api/src/plugins/auth.ts.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
    const { email, password } = request.body ?? {};
    if (!email || !password) {
      throw polarError("VALIDATION_ERROR", "email and password are required.");
    }

    const session = await login(email, password, app.sessionStore);
    reply.code(201);
    return {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      actor: { userId: session.actor.userId, roles: session.actor.roles },
    };
  });

  app.post("/auth/logout", { preHandler: app.authenticate }, async (request, reply) => {
    const header = request.headers.authorization;
    const sessionId = header?.slice("Bearer ".length);
    if (sessionId) {
      await app.sessionStore.revoke(sessionId);
    }
    reply.code(204);
    return null;
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (request) => {
    return { actor: request.actor };
  });
}
