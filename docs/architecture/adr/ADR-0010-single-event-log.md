# ADR-0010: One append-only event table, not three parallel ones

## Status
Accepted

## Context
The master prompt's table list names `analytics.event`, `analytics.customer_event`, and
`analytics.commerce_event` as if they were three separate physical tables.

## Decision
Implement a single physical, append-only table, `analytics.event`, with `dedupe_key`-based idempotency
(see `docs/architecture/event-model.md`). `analytics.customer_event` and `analytics.commerce_event` are
implemented as SQL views filtering `analytics.event` (by `customer_id is not null` and by
commerce-related `event_type` prefixes, respectively), not as physically duplicated tables.

## Rationale
- Three physical tables receiving overlapping writes (a commerce event is *also* a customer event) creates
  a dual/triple-write hazard: every producer would need to decide which table(s) to write, and any missed
  write silently desyncs a metric.
- A single append-only log with narrow, read-optimized views gives the same query ergonomics
  (`analytics.commerce_event` is still a normal queryable relation) without a second source of truth to
  keep consistent.
- Matches the general principle of one idempotent producer path per fact (see Event Model §4).

## Consequences
- Views add a small query-planning indirection versus a physically denormalized table; acceptable at
  current expected volume. If `commerce_event`/`customer_event` query patterns later need their own
  indexing strategy that a view can't provide efficiently, they can be converted to materialized views (or
  genuinely separate tables fed by the same single producer path) without changing any consumer's
  interface.

## Alternatives considered
- **Three physical tables, each written independently** — rejected per Rationale above: real risk of
  metric drift from partial writes, for no query-time benefit at current scale.
