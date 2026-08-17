import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { PolarError } from "@polar/security";

/**
 * Central error handler — never leak stack traces to the client
 * (docs/security/security-architecture.md §10).
 */
export function handleError(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof PolarError) {
    request.log.warn({ err: error, code: error.code }, "Handled application error");
    reply.status(error.statusCode).send(error.toJSON());
    return;
  }

  request.log.error({ err: error }, "Unhandled error");
  reply.status(500).send({ code: "INTERNAL_ERROR", message: "Something went wrong." });
}
