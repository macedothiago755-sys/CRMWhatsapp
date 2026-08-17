# ADR-0001: PostgreSQL as the primary datastore

## Status
Accepted

## Context
Polar AI Commerce needs a System of Record for customer identity, consent, profiles, preferences,
conversations, and events, plus a place to run vector similarity search for RAG (see ADR-0006), and
strong relational integrity across many bounded contexts (CRM, Conversation, AI, Commerce references,
Knowledge, Campaign, Consent, Analytics, Security).

## Decision
Use PostgreSQL as the single primary datastore, with one schema per bounded context (see
`docs/architecture/data-architecture.md` §2).

## Rationale
- Mature relational guarantees (FKs, constraints, transactions) fit a domain with heavy referential
  integrity needs (identity resolution, consent, audit).
- `pgvector` extension lets RAG embeddings live in the same database as the data they're grounded in,
  avoiding a second vector database for an initial-scale corpus (ADR-0006).
- `jsonb` columns give flexible, indexable semi-structured storage (event metadata, tool I/O, message
  payloads) without needing a document database alongside the relational one.
- Wide operational familiarity, strong managed-hosting options across providers not yet finalized
  (`docs/architecture/environment-strategy.md` §5), and does not lock the infra decision.

## Consequences
- Schema-per-context discipline is a convention, not a hard multi-database boundary — cross-context code
  access must still go through the owning package (see `data-architecture.md` §2). This needs code review
  discipline, not just a technical barrier.
- Vector search performance at very large corpus scale may eventually require a dedicated vector store;
  revisit if/when `knowledge.chunk` volume or query latency demands it (see ADR-0006 consequences).

## Alternatives considered
- **Polyglot persistence from day one** (separate document/vector/relational stores) — rejected: adds
  operational complexity and consistency risk before it's earned by actual scale (master prompt §49,
  avoid premature optimization).
