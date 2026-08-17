import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Correlation ID propagation — see docs/architecture/observability-strategy.md §3.
 * One ID threads WhatsApp message → API → Queue → AI → Tool → VTEX → Response.
 */
const storage = new AsyncLocalStorage<{ correlationId: string }>();

export const CORRELATION_HEADER = "x-correlation-id";

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

export function getCorrelationId(): string {
  return storage.getStore()?.correlationId ?? randomUUID();
}

export function newCorrelationId(): string {
  return randomUUID();
}
