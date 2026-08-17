# Event Model — Polar AI Commerce

## 1. Schema

```text
event_id      uuid
event_type    text   -- e.g. customer.created, message.received
dedupe_key    text   -- idempotency key, unique
customer_id   uuid   -- nullable (not every event is customer-scoped)
conversation_id uuid -- nullable
entity_type   text   -- nullable, e.g. 'product', 'order'
entity_id     uuid   -- nullable
source        text   -- e.g. 'whatsapp-webhook', 'ai-orchestrator', 'admin-app'
metadata      jsonb
occurred_at   timestamptz
```

Physical table: `analytics.event` (see [Data Model](../data/data-model.md) §analytics).

## 2. Canonical event types (extensible — this is a starting taxonomy, not a closed enum)

```text
customer.created
conversation.started
message.received
message.sent
intent.detected
product.recommended
product.selected
cart.created
cart.item_added
checkout.started
order.created
order.paid
order.delivered
campaign.sent
campaign.delivered
campaign.converted
consent.granted
consent.revoked
```

New event types are added by convention (`<entity>.<past-tense-verb>`), not by a schema migration — the
`event_type` column is free text validated at the application layer against a maintained registry in
`packages/analytics`, so new types ship without a DB migration but still can't silently typo their way into
the data.

## 3. Idempotency

Every event write goes through `dedupe_key`, a deterministic function of the originating fact (e.g.
`sha256(source + provider_message_id + event_type)` for a WhatsApp-derived event, or
`sha256('order.created' + vtex_order_id)` for an order event). The `unique` constraint on `dedupe_key` makes
duplicate emission (webhook redelivery, worker retry) a safe no-op, not a double-counted metric.

## 4. Producers

Any package may emit an event through a shared `EventBus`/`AnalyticsEventPublisher` in `packages/analytics`
— it is the only writer to `analytics.event`. This keeps the event schema consistent regardless of which
bounded context produced the fact (CRM, Conversation, Commerce, Campaign, Consent, AI).

## 5. Consumers

- **Customer Timeline** (`crm.customer_timeline`) — a read model populated from relevant customer-scoped
  events.
- **Analytics** metrics (§ Analytics in the roadmap/Phase 6) — aggregated from `analytics.event` and its
  `customer_event`/`commerce_event` views.
- **AI Insights** (Phase 7) — pattern analysis over the event stream, never over raw conversation transcripts
  directly, so insight generation stays auditable back to specific events.
- **Future data warehouse** — the event schema is designed to be replay-able into an external DWH
  (BigQuery/Snowflake/Redshift/Databricks) via ETL/ELT without touching operational tables (see
  [Data Architecture](data-architecture.md) §6).

## 6. What is *not* in the event log

Full message bodies and AI prompt/response payloads are not duplicated into `event.metadata` — the event
references the entity (`conversation_id`, `entity_id`) and the owning table holds the detail. This keeps
the event log lean, keeps PII minimization intact (metadata should carry only what's needed for
analytics/timeline rendering, not full content), and avoids a second source of truth for message content.
