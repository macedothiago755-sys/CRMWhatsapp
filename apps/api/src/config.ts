/**
 * Centralized environment config loading. Fails fast on startup if a required
 * variable is missing, rather than surfacing a confusing error deep in a request
 * handler — see docs/architecture/environment-strategy.md §2.
 *
 * WhatsApp credentials are intentionally optional here, not required: Meta
 * Business Account provisioning is a pending Product Owner decision
 * (docs/whatsapp/whatsapp-architecture.md §5), and the server must still boot
 * and serve every other endpoint without them. The WhatsApp webhook/send
 * routes fail loudly with a clear error if invoked while unconfigured — see
 * apps/api/src/routes/whatsappWebhook.ts and apps/api/src/routes/conversations.ts.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  corsOrigin: string;
  databaseUrl: string;
  redisUrl: string;
  whatsapp: {
    accessToken: string | undefined;
    phoneNumberId: string | undefined;
    webhookVerifyToken: string | undefined;
    appSecret: string | undefined;
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    nodeEnv: process.env["NODE_ENV"] ?? "development",
    port: Number(process.env["PORT"] ?? 3001),
    logLevel: process.env["LOG_LEVEL"] ?? "info",
    corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
    databaseUrl: required("DATABASE_URL"),
    redisUrl: required("REDIS_URL"),
    whatsapp: {
      accessToken: process.env["WHATSAPP_ACCESS_TOKEN"],
      phoneNumberId: process.env["WHATSAPP_PHONE_NUMBER_ID"],
      webhookVerifyToken: process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"],
      appSecret: process.env["WHATSAPP_APP_SECRET"],
    },
  };
}
