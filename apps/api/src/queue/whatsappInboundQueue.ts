import { Queue, Worker, type Job } from "bullmq";
import { logger } from "@polar/observability";
import { getRedisConnection } from "./connection.js";
import { processInboundWhatsAppPayload } from "../services/inboundWhatsAppProcessor.js";

/**
 * Inbound WhatsApp webhook processing queue — see
 * docs/architecture/integration-architecture.md §3: the webhook handler's only
 * synchronous job is verification + enqueue; everything else (identity
 * resolution, persistence, side effects) happens here, off the request path,
 * with BullMQ's retry/backoff handling transient failures and its failed-job
 * list acting as the dead-letter queue (docs/architecture/system-overview.md
 * "Resilience").
 */
const QUEUE_NAME = "whatsapp-inbound";

interface InboundJobData {
  payload: unknown;
}

let queue: Queue<InboundJobData> | undefined;

export function getWhatsAppInboundQueue(redisUrl: string): Queue<InboundJobData> {
  if (!queue) {
    queue = new Queue<InboundJobData>(QUEUE_NAME, { connection: getRedisConnection(redisUrl) });
  }
  return queue;
}

export async function enqueueInboundWebhookEvent(redisUrl: string, payload: unknown): Promise<void> {
  await getWhatsAppInboundQueue(redisUrl).add(
    "inbound-event",
    { payload },
    {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600 }, // keep completed jobs 1h for observability, then prune
      removeOnFail: false, // failed jobs stay for inspection/manual replay (the DLQ)
    },
  );
}

export function startWhatsAppInboundWorker(redisUrl: string): Worker<InboundJobData> {
  const worker = new Worker<InboundJobData>(
    QUEUE_NAME,
    async (job: Job<InboundJobData>) => {
      await processInboundWhatsAppPayload(job.data.payload);
    },
    { connection: getRedisConnection(redisUrl), concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "WhatsApp inbound job failed");
  });

  return worker;
}
