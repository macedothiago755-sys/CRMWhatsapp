import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { PgSessionStore } from "@polar/auth";
import { polarError, requirePermission as assertPermission, type AuthenticatedActor, type PermissionKey } from "@polar/security";

/**
 * Authentication/authorization plugin — see docs/security/security-architecture.md §1-2.
 * Sessions are opaque ids (security.session.id) presented as a Bearer token;
 * lookup is server-side and revocable, never a self-contained/stateless token.
 */
declare module "fastify" {
  interface FastifyInstance {
    sessionStore: PgSessionStore;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    actor?: AuthenticatedActor;
  }
}

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  const sessionStore = new PgSessionStore();
  app.decorate("sessionStore", sessionStore);
  app.decorateRequest("actor", undefined);

  app.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw polarError("UNAUTHORIZED", "Missing bearer token.");
    }

    const sessionId = header.slice("Bearer ".length);
    const session = await sessionStore.get(sessionId);
    if (!session) {
      throw polarError("UNAUTHORIZED", "Invalid or expired session.");
    }

    request.actor = session.actor;
  });
}

export const authPlugin = fp(authPluginImpl, { name: "auth-plugin" });

/** Fastify preHandler factory: authenticates, then requires a specific permission. */
export function requirePermission(permission: PermissionKey) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const app = request.server;
    await app.authenticate(request, reply);
    assertPermission(request.actor as AuthenticatedActor, permission);
  };
}
