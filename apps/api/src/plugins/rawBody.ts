import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

/**
 * Captures the raw request body alongside Fastify's normal JSON parsing, so
 * webhook signature verification (HMAC over the exact bytes Meta sent) can
 * happen without re-serializing a parsed object — re-serialization is not
 * guaranteed to byte-for-byte match the original payload (key order, spacing).
 */
declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

async function rawBodyPluginImpl(app: FastifyInstance): Promise<void> {
  app.decorateRequest("rawBody", undefined);

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    request.rawBody = buf;
    if (buf.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(buf.toString("utf8")));
    } catch {
      const err = new Error("Malformed JSON body") as Error & { statusCode: number };
      err.statusCode = 400;
      done(err, undefined);
    }
  });
}

export const rawBodyPlugin = fp(rawBodyPluginImpl, { name: "raw-body-plugin" });
