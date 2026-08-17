# ADR-0004: VTEX remains the transactional System of Record

## Status
Accepted

## Context
Polar already operates on VTEX for catalog, pricing, inventory, cart, checkout, payment, and order
management. The new platform must not create a second, competing source of truth for any of this.

## Decision
VTEX stays authoritative for catalog/SKU, price, availability, cart, checkout, payment, and order status.
Polar AI Commerce stores only references and point-in-time snapshots (`commerce.product_reference`,
`commerce.product_snapshot`, `commerce.cart`, `commerce.order_reference`) for relationship and analytics
purposes, isolated behind `packages/vtex` (see `docs/vtex/vtex-architecture.md`).

## Rationale
- Avoids dual-write/consistency problems between two "official" order or inventory systems.
- Matches the explicit product mandate: the CRM augments commerce with conversation/relationship data, it
  does not re-implement commerce.
- Keeps the blast radius of a VTEX outage bounded — the CRM can still degrade gracefully (be honest about
  not knowing current stock/price) rather than serving stale data as if authoritative.

## Consequences
- Every transactional AI tool call (price, stock, checkout) round-trips to VTEX rather than trusting a
  local snapshot, adding latency the orchestrator's context/prompt design must budget for
  (`docs/architecture/ai-architecture.md` §10).
- The `packages/vtex` adapter is a hard dependency for Phase 5 acceptance; live implementation is blocked
  on VTEX credentials/API scope being provided (pending decision, `docs/vtex/vtex-architecture.md` §5).

## Alternatives considered
- **Sync a full local copy of catalog/inventory** — rejected: master prompt §67 explicitly forbids
  duplicating the full VTEX catalog without necessity; a snapshot-on-demand model is sufficient for
  recommendation ranking and avoids staleness risk on the fields that matter most (price, stock).
