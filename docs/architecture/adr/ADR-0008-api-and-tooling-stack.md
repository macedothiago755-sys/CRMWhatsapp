# ADR-0008: API framework, ORM/migrations, logging, and test tooling

## Status
Accepted

## Context
Phase 0 needs concrete choices to scaffold a working `apps/api` and shared `packages/database` — the
master prompt fixes the high-level stack (Node.js, TypeScript, PostgreSQL, Redis, BullMQ) but leaves
framework-level tooling open.

## Decision
- **Package manager / monorepo tooling**: pnpm workspaces.
- **API framework**: Fastify — TypeScript-first, built-in JSON Schema request/response validation
  (supports the "typed APIs, validation everywhere" principle directly), lower overhead than Express for a
  webhook-heavy, latency-sensitive gateway.
- **Database access / migrations**: Drizzle ORM + Drizzle Kit for TypeScript-typed queries and versioned
  SQL migrations, with `pgvector` support. Raw, hand-written SQL migrations (as in `database/migrations/`)
  remain the canonical source for schema changes; Drizzle's schema definitions in `packages/database` are
  kept in sync with them and are the typed query layer the rest of the app uses.
- **Logging**: `pino` — structured JSON logging, low overhead, well-supported Fastify integration.
- **Test framework**: Vitest — fast, native TypeScript/ESM support, one runner for unit/integration tests;
  Playwright reserved for `tests/e2e` if/when a browser-driven admin-app flow needs it.
- **Queue**: BullMQ on Redis, per the master prompt's explicit direction, with a `packages/observability`
  wrapper so a future swap (SQS/Pub/Sub/Kafka) is isolated (master prompt §5).

## Rationale
Each choice optimizes for: TypeScript-first ergonomics, schema validation as a first-class concern (not
bolted on), and minimizing framework lock-in on the boundaries most likely to change (queue backend, model
provider — the latter covered by ADR-0007).

## Consequences
- Fastify and Drizzle are both less ubiquitous than Express/Prisma; the trade is stronger typing and
  built-in validation against a marginally smaller ecosystem — acceptable for a greenfield, TypeScript-
  strict codebase.
- Raw SQL migrations plus a separate ORM schema definition means two places describe the schema; this is a
  deliberate trade to keep the SQL migrations human-auditable (important for LGPD/production-safety review)
  while still getting typed queries. Drift between the two is caught by an integration test that runs the
  migrations and asserts Drizzle's introspected schema matches.

## Alternatives considered
- **Express + Prisma** — more ubiquitous, but Prisma's migration model is less amenable to hand-reviewed,
  reversible raw SQL migrations, and Express needs an added validation layer (e.g. Zod middleware) to reach
  the same "every boundary validated" bar Fastify gives natively.
- **npm workspaces instead of pnpm** — viable, but pnpm's stricter dependency isolation better suits a
  monorepo with many internal packages sharing dependencies.
