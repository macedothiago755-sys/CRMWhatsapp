# Observability Strategy — Polar AI Commerce

## 1. Logs

Structured JSON logs everywhere (`packages/observability`, `pino` — see ADR-0008). Every log line carries,
at minimum: `timestamp`, `level`, `correlation_id`, `service`, `message`, and relevant entity ids
(`customer_id`, `conversation_id`, `execution_id`) when available. PII fields are redacted before logging
per [AI Governance](../ai/ai-governance.md) §4.

## 2. Metrics

Minimum set from day one (OpenTelemetry metrics, exported per the configured `OTEL_EXPORTER_OTLP_ENDPOINT`):

- request count, latency (p50/p95/p99), error rate — per route;
- queue depth and processing latency (BullMQ);
- AI latency and token usage — per agent;
- VTEX adapter latency/error rate — per service method;
- WhatsApp send/delivery failure rate.

## 3. Traces

Every request is correlated end-to-end:

```text
WhatsApp Message → API → Queue → AI → Tool → VTEX → Response
```

via a single `correlation_id` generated at the webhook gateway (or API entry point) and propagated through
queue job payloads, into `ai.agent_execution`/`ai.tool_execution` records, and into every downstream log
line and outbound HTTP call header. OpenTelemetry tracing spans mirror this same path so a single trace can
be inspected end-to-end in whatever tracing backend is configured.

## 4. Error tracking

Sentry (or equivalent, per ADR — ADR-0008) captures unhandled exceptions with the same `correlation_id`
attached, so an error can be joined back to its logs/traces/AI execution record.

## 5. AI-specific observability

Covered in depth in [AI Governance](../ai/ai-governance.md) §3 — the `ai.agent_execution` /
`ai.tool_execution` tables are the system of record for AI observability, not log aggregation alone. Cost
and latency anomaly alerting (per conversation/customer/agent) is a Phase 6 (Analytics) deliverable, built
on top of this data.

## 6. Health checks

`apps/api` exposes `/health` (liveness: process is up) and `/health/ready` (readiness: DB, Redis, and
critical external dependencies reachable) from Phase 0 — required for any deployment platform's health
probes and the first thing verified after every deploy.
