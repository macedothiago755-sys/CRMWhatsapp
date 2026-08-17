# Integration Architecture — Polar AI Commerce

## 1. External systems

| System | Role | Adapter package | Detail doc |
|---|---|---|---|
| Meta WhatsApp Business Platform (Cloud API) | Conversational channel | `packages/whatsapp` | [WhatsApp Architecture](../whatsapp/whatsapp-architecture.md) |
| VTEX | Transactional System of Record (catalog, price, stock, cart, checkout, order, payment) | `packages/vtex` | [VTEX Architecture](../vtex/vtex-architecture.md) |
| Anthropic Claude API | AI reasoning/generation | `packages/ai` (`AnthropicProvider`) | [AI Architecture](ai-architecture.md) |
| S3-compatible storage | Media attachments, exports | `packages/observability` / shared infra util (TBD Phase 1) | — |

## 2. Integration principles (apply to every external adapter)

1. **Isolation** — all calls to a given external system go through its one adapter package. No VTEX or
   Meta SDK call appears outside `packages/vtex` / `packages/whatsapp` respectively.
2. **Timeout on every call.** No external call is unbounded.
3. **Retry with exponential backoff** for transient failures, bounded attempt count.
4. **Circuit breaker** where a dependency's failure mode can otherwise cascade (e.g. VTEX outage should not
   pin every orchestrator worker waiting on timeouts).
5. **Idempotency** for anything that creates state (cart creation, order creation, message send) — see
   §5 below and each detail doc.
6. **Structured logs + a correlation ID** threading `WhatsApp message → API → Queue → AI → Tool → VTEX →
   Response` (see Observability Strategy).
7. **Never invent an endpoint or payload shape.** Before implementing or changing an adapter, confirm
   against the current official documentation (Meta, VTEX) — API surfaces change and this repo must not
   assume otherwise. This is process, not a one-time check (master prompt §79–80).

## 3. Webhook ingestion pattern (WhatsApp inbound)

```text
Meta → POST /webhooks/whatsapp → verify signature → ack (2xx, sub-second)
                                        │
                                        ▼
                              enqueue raw event (BullMQ)
                                        │
                                        ▼
                     worker: dedupe by provider_message_id → normalize →
                     persist conversation.message → AI Orchestrator
```

The webhook handler's only synchronous job is signature verification, dedupe-key extraction, and enqueue.
Everything else — identity resolution, persistence, AI orchestration, VTEX calls — happens in a worker.
This bounds webhook ack latency independently of AI/VTEX latency (master prompt §48).

## 4. Outbound message pattern

Orchestrator/response-generation produces a message → `packages/whatsapp` sends it via the Cloud API →
delivery/read status updates arrive as further webhooks and update `conversation.message.status`. Template
messages (for campaigns or outside the 24h customer service window) go through Meta's template approval
flow — status tracked in `campaign.template.status`.

## 5. Idempotency, concretely

| Operation | Idempotency key | Mechanism |
|---|---|---|
| Inbound WhatsApp message | `provider_message_id` (Meta message id) | `unique` constraint on `conversation.message.provider_message_id`; webhook worker upserts/no-ops on conflict |
| Cart creation | `(customer_id, open-cart)` | Application logic checks for an existing `status='open'` cart before creating a new one; `commerce.cart.vtex_cart_id` is also unique |
| Order creation reference | `vtex_order_id` | `unique` constraint on `commerce.order_reference.vtex_order_id` |
| Campaign delivery | `(execution_id, customer_id)` | `unique` constraint on `campaign.delivery` |
| Analytics events | `dedupe_key` | `unique` constraint on `analytics.event.dedupe_key`, derived from source + provider id + type |

## 6. Resilience posture per dependency

- **Claude unavailable** → orchestrator falls back to a scripted holding response, conversation flagged for
  retry/escalation. The rest of the platform (webhook ingestion, CRM, VTEX-independent flows) keeps
  running.
- **VTEX unavailable** → the AI must never assert stock availability, price, or order status from stale
  data; tools return a typed `VTEX_UNAVAILABLE` error, and the response-generation stage is instructed to
  say so plainly rather than guess.
- **WhatsApp (Meta) unavailable** → outbound sends are queued (BullMQ) with retry/backoff; nothing is
  silently dropped. Inbound webhook delivery gaps are Meta's problem to retry, but our dedupe key makes
  redelivery safe either way.

## 7. Correlation

Every request entering the system at the webhook gateway is assigned a `correlation_id` (propagated via
`X-Correlation-Id` internally, attached to every log line and to `ai.agent_execution`/`ai.tool_execution`
rows for that flow) — see [Observability Strategy](observability-strategy.md).
