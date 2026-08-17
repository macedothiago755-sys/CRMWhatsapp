import type { FastifyInstance } from "fastify";
import { getPool } from "@polar/database";
import { getRedisConnection } from "../queue/connection.js";
import type { AppConfig } from "../config.js";

/**
 * Health checks — see docs/architecture/observability-strategy.md §6.
 * /health        liveness: the process is up.
 * /health/ready  readiness: critical dependencies (DB, Redis) are reachable.
 */
export async function healthRoutes(app: FastifyInstance, opts: { config: AppConfig }): Promise<void> {
  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/health/ready", async (_request, reply) => {
    const [dbResult, redisResult] = await Promise.allSettled([
      getPool().query("select 1"),
      getRedisConnection(opts.config.redisUrl).ping(),
    ]);

    const database = dbResult.status === "fulfilled" ? "reachable" : "unreachable";
    const redis = redisResult.status === "fulfilled" ? "reachable" : "unreachable";

    if (dbResult.status === "rejected") {
      app.log.error({ err: dbResult.reason }, "Readiness check failed: database unreachable");
    }
    if (redisResult.status === "rejected") {
      app.log.error({ err: redisResult.reason }, "Readiness check failed: redis unreachable");
    }

    const ok = database === "reachable" && redis === "reachable";
    reply.code(ok ? 200 : 503);
    return { status: ok ? "ok" : "degraded", database, redis };
  });
}
