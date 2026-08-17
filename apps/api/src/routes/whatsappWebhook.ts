import type { FastifyInstance } from "fastify";
import { verifySubscriptionChallenge, verifyWebhookSignature } from "@polar/whatsapp";
import { polarError } from "@polar/security";
import { enqueueInboundWebhookEvent } from "../queue/whatsappInboundQueue.js";
import type { AppConfig } from "../config.js";

interface VerifyQuery {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
}

/**
 * WhatsApp Cloud API webhook — see docs/architecture/integration-architecture.md §3.
 * GET handles Meta's one-time subscription verification handshake; POST
 * receives inbound message/status events. The POST handler's only synchronous
 * work is signature verification and enqueue — everything else happens in the
 * queue worker (apps/api/src/queue/whatsappInboundQueue.ts).
 */
export async function whatsappWebhookRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get<{ Querystring: VerifyQuery }>("/webhooks/whatsapp", async (request, reply) => {
    if (!config.whatsapp.webhookVerifyToken) {
      throw polarError("INTERNAL_ERROR", "WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured.");
    }

    const challenge = verifySubscriptionChallenge(
      request.query["hub.mode"],
      request.query["hub.verify_token"],
      request.query["hub.challenge"],
      config.whatsapp.webhookVerifyToken,
    );

    if (challenge === null) {
      reply.code(403);
      return "Forbidden";
    }

    reply.type("text/plain");
    return challenge;
  });

  app.post("/webhooks/whatsapp", async (request, reply) => {
    if (!config.whatsapp.appSecret) {
      throw polarError("INTERNAL_ERROR", "WHATSAPP_APP_SECRET is not configured.");
    }

    const signatureHeader = request.headers["x-hub-signature-256"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const rawBody = request.rawBody;
    if (!rawBody || !verifyWebhookSignature(rawBody, signature, config.whatsapp.appSecret)) {
      reply.code(401);
      return { status: "invalid_signature" };
    }

    // Ack fast: enqueue and return, don't wait for processing
    // (docs/architecture/integration-architecture.md §3).
    await enqueueInboundWebhookEvent(config.redisUrl, request.body);

    return { status: "received" };
  });
}
