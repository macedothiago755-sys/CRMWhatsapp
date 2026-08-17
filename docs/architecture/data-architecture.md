# Data Architecture — Polar AI Commerce

## 1. Ownership boundaries

| Data domain | System of Record | Polar DB role |
|---|---|---|
| Customer identity, consent, profile, preferences, conversations, events | **PostgreSQL (Polar)** | SoR |
| Catalog, price, stock, cart, checkout, payment, order status | **VTEX** | Reference + point-in-time snapshot only |
| Institutional/product knowledge for RAG | **PostgreSQL (Polar) + pgvector** | SoR |
| AI reasoning output (recommendations, summaries, classifications) | **Neither** — derived, regenerable | Persisted for audit/analytics, never authoritative for price/stock/policy |

## 2. Schema-per-context

One PostgreSQL database, one schema per bounded context, enforced by convention and by which package is
allowed to hold a connection/repository for that schema:

```text
crm.*          — packages/crm
conversation.* — packages/conversation
ai.*           — packages/ai
commerce.*     — packages/commerce
knowledge.*    — packages/knowledge
campaign.*     — packages/campaigns
consent.*      — packages/crm (consent is CRM-adjacent, kept as its own schema for LGPD auditability)
analytics.*    — packages/analytics
security.*     — packages/security
```

Cross-schema reads happen only through the owning package's exported repository/service functions — never
raw cross-schema joins from a different package. This keeps the "modular" in modular monolith real, and is
what makes future service extraction (ADR-0002) tractable.

## 3. Baseline conventions (applies to every table)

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` unless a natural key is unavoidable (lookup/enum tables).
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` (updated
  via trigger, not application code, to avoid drift).
- Soft delete (`deleted_at TIMESTAMPTZ NULL`) on entities with a real business lifecycle (customers,
  conversations, documents, campaigns). Hard delete only where LGPD erasure requires it (see
  `consent`/`security` docs) — and even then, through an auditable erasure procedure, not a bare `DELETE`.
- Foreign keys are always declared (no implicit/app-only referential integrity).
- Every table that other tables reference has an index on its PK (implicit) and every FK column is indexed.
- No `SELECT *` in application code; no unbounded result sets — pagination is mandatory on list endpoints.
- Enum-like columns that are likely to grow (intent types, event types) are lookup tables or `TEXT` with a
  `CHECK` constraint plus an app-level typed union, not native Postgres `ENUM` (which is painful to extend
  under migration discipline).

## 4. Identity keys

- `crm.customer.id` (UUID) is the only cross-context customer reference. Phone/email are never used as a
  join key outside `crm.customer_identity`.
- `conversation.conversation.customer_id`, `ai.agent_execution.customer_id`,
  `commerce.cart.customer_id`, etc. all reference `crm.customer.id`.

## 5. RAG storage

`pgvector` extension on the same PostgreSQL instance (ADR-0006) — `knowledge.embedding.vector` column,
indexed with an IVFFlat/HNSW index once corpus size justifies it. No separate vector database until scale
or feature needs (e.g. hybrid search infra beyond pgvector's capability) demand it.

## 6. Event layer → analytics → future warehouse

`analytics.event` (and the narrower `analytics.customer_event` / `analytics.commerce_event`) is an
append-only, idempotent event log (see [Event Model](event-model.md)). It is designed so that a future
ETL/ELT job can replay it into BigQuery/Snowflake/Redshift/Databricks without any schema surgery on the
operational database — the event schema is the contract, not the operational tables.

## 7. Data lineage

For any data point that could be shown to a customer or used in a business decision, the platform must be
able to answer: *where did this come from, when was it fetched/updated, who/what system produced it, what
transformation was applied.* Two concrete patterns:

- **Transactional data** (price, stock): every `ProductSnapshot` row carries `source='VTEX'`,
  `fetched_at`, and the VTEX response identifiers used. The AI is told to treat anything older than a
  configured TTL as stale and re-fetch rather than trust the snapshot.
- **Inferred customer data** (preferences): every `customer_preference` row carries `source`,
  `confidence`, and (via `ai.tool_execution`/`conversation.message`) a traceable path back to the
  conversation and message that produced it.

## 8. Full table catalog and ERD

See [`docs/data/data-model.md`](../data/data-model.md) for the complete table-by-table catalog (columns,
PK/FK/unique/index detail) and the entity-relationship diagram. See `database/migrations/` for the executable
schema.
