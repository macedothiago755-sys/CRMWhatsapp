import pino from "pino";

/**
 * Fields that must never reach a log sink verbatim. This is a coarse net, not a
 * substitute for not putting PII into logs in the first place — see
 * docs/ai/ai-governance.md §4.
 */
const REDACT_PATHS = [
  "*.password",
  "*.phone",
  "*.email",
  "*.body_text",
  "*.access_token",
  "*.apiKey",
  "*.api_key",
];

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}

export type Logger = pino.Logger;
