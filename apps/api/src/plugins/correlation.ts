import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CORRELATION_HEADER, newCorrelationId, runWithCorrelationId } from "@polar/observability";

/**
 * Assigns/propagates a correlation id for every request — see
 * docs/architecture/observability-strategy.md §3.
 */
export async function correlationPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", (request: FastifyRequest, reply: FastifyReply, done) => {
    const incoming = request.headers[CORRELATION_HEADER];
    const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? newCorrelationId();
    reply.header(CORRELATION_HEADER, correlationId);
    runWithCorrelationId(correlationId, () => done());
  });
}
