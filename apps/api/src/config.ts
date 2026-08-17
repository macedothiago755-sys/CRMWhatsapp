/**
 * Centralized environment config loading. Fails fast on startup if a required
 * variable is missing, rather than surfacing a confusing error deep in a request
 * handler — see docs/architecture/environment-strategy.md §2.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  corsOrigin: string;
  databaseUrl: string;
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
  };
}
