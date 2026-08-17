import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { startWhatsAppInboundWorker } from "./queue/whatsappInboundQueue.js";
import { closeRedisConnection } from "./queue/connection.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp(config);
  const worker = startWhatsAppInboundWorker(config.redisUrl);

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "Shutting down");
    await worker.close();
    await app.close();
    await closeRedisConnection();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
