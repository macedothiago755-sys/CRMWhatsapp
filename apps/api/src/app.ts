import Fastify, { type FastifyInstance } from "fastify";
import sensible from "@fastify/sensible";
import { correlationPlugin } from "./plugins/correlation.js";
import { healthRoutes } from "./routes/health.js";
import { handleError } from "./errorHandler.js";
import type { AppConfig } from "./config.js";

/**
 * Composition root — see docs/architecture/repository-structure.md.
 * apps/api wires packages together and exposes the HTTP surface; it is the only
 * process holding a database connection.
 *
 * Fastify owns its own request-scoped pino logger (structured JSON, same
 * redaction concerns as @polar/observability — see docs/architecture/
 * observability-strategy.md §1) rather than being handed our shared logger
 * instance directly, to avoid coupling Fastify's internal logger typing to
 * @polar/observability's. Code outside the HTTP request lifecycle (queue
 * workers, scripts) uses @polar/observability's `logger` directly.
 */
export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: { paths: ["req.headers.authorization"], censor: "[REDACTED]" },
    },
  });

  await app.register(sensible);
  await app.register(correlationPlugin);
  await app.register(healthRoutes);

  app.setErrorHandler(handleError);

  void config; // reserved for CORS/route registration as they're added in later phases

  return app;
}
