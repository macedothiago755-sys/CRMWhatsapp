# ADR-0002: Modular monolith over microservices at launch

## Status
Accepted

## Context
The platform has many bounded contexts (CRM, Conversation, AI, Commerce, Knowledge, Campaign, Consent,
Analytics, Security) but no production traffic yet and no team-ownership boundaries requiring independent
deployability today.

## Decision
Build a modular monolith: one deployable API process (`apps/api`) composed of independently-packaged
domain modules (`packages/*`), each with a clean public interface and its own database schema.

## Rationale
- Microservices without a driving need add operational overhead (deployment, service discovery, distributed
  transactions/sagas, network failure modes) that this project doesn't yet need (master prompt §67:
  "nunca criar microservices sem necessidade").
- Package boundaries + schema-per-context (ADR-0001) give most of the decomposition benefit (enforced
  interfaces, independent testability) without the distributed-systems cost.
- Cross-context calls are in-process function calls today; extracting a context into its own service later
  means replacing an in-process call with an HTTP/queue call behind the same package interface — a
  contained refactor, not a rewrite.

## Consequences
- Discipline is required to keep packages honestly decoupled (no reaching into another schema, no deep
  imports) — enforced via code review and, ideally, lint rules restricting cross-package imports to public
  entry points.
- A single process/deploy for `apps/api` means a bug in one module can, in the worst case, affect the whole
  API's availability — mitigated by the resilience patterns in `docs/architecture/integration-architecture.md`
  (timeouts, circuit breakers, no unbounded work on the request path).

## Alternatives considered
- **Microservices per bounded context** — rejected for now: premature given no scale/team pressure yet;
  revisit per-context if/when a specific context's load or ownership needs diverge sharply from the rest.
