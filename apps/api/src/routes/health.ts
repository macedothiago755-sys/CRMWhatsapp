import type { FastifyInstance } from "fastify";
import { getPool } from "@polar/database";

/**
 * Health checks — see docs/architecture/observability-strategy.md §6.
 * /health        liveness: the process is up.
 * /health/ready  readiness: critical dependencies (DB) are reachable.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/health/ready", async (_request, reply) => {
    try {
      await getPool().query("select 1");
      return { status: "ok", database: "reachable" };
    } catch (err) {
      app.log.error({ err }, "Readiness check failed: database unreachable");
      reply.code(503);
      return { status: "degraded", database: "unreachable" };
    }
  });
}
