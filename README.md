# Polar AI Commerce

A proprietary Customer Data Platform + WhatsApp CRM + AI Commerce platform for Polar — combining CRM,
Customer 360, conversational commerce over WhatsApp, an AI orchestration layer built on Claude, and
integration with VTEX as the transactional system of record.

This is not a chatbot with a database. See [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md)
for the full picture, and [`CLAUDE.md`](CLAUDE.md) for the engineering ground rules.

## Status

**Phase 0 — Architecture & Foundation.** Architecture is documented, the database schema is defined, and
the monorepo skeleton is scaffolded. Live external integrations (WhatsApp, VTEX, Claude) are not yet wired
up — see [`docs/architecture/roadmap.md`](docs/architecture/roadmap.md) for the phase plan and each
integration doc's "Pending decisions" section for what's blocking the next phase.

## Documentation map

| Topic | Doc |
|---|---|
| System overview | [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md) |
| Domain model | [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md) |
| Data architecture | [`docs/architecture/data-architecture.md`](docs/architecture/data-architecture.md) |
| Data model / ERD | [`docs/data/data-model.md`](docs/data/data-model.md) |
| AI architecture | [`docs/architecture/ai-architecture.md`](docs/architecture/ai-architecture.md) |
| AI governance | [`docs/ai/ai-governance.md`](docs/ai/ai-governance.md) |
| Integration architecture | [`docs/architecture/integration-architecture.md`](docs/architecture/integration-architecture.md) |
| WhatsApp | [`docs/whatsapp/whatsapp-architecture.md`](docs/whatsapp/whatsapp-architecture.md) |
| VTEX | [`docs/vtex/vtex-architecture.md`](docs/vtex/vtex-architecture.md) |
| Security | [`docs/security/security-architecture.md`](docs/security/security-architecture.md) |
| Event model | [`docs/architecture/event-model.md`](docs/architecture/event-model.md) |
| Repository structure | [`docs/architecture/repository-structure.md`](docs/architecture/repository-structure.md) |
| Environment strategy | [`docs/architecture/environment-strategy.md`](docs/architecture/environment-strategy.md) |
| Observability strategy | [`docs/architecture/observability-strategy.md`](docs/architecture/observability-strategy.md) |
| ADRs | [`docs/architecture/adr/`](docs/architecture/adr/) |
| Roadmap | [`docs/architecture/roadmap.md`](docs/architecture/roadmap.md) |

## Getting started

Requires Node.js >= 20 and pnpm.

```bash
pnpm install
cp .env.example .env   # fill in local values; never commit real secrets
pnpm migrate            # apply database migrations (requires a running Postgres — see docker-compose below)
pnpm dev                 # run apps/api in dev mode
pnpm test                 # run the test suite
```

### Local infrastructure

Local Postgres + Redis are expected on the ports in `.env.example`. Use whatever local setup you prefer
(Docker, native install); a `docker-compose.yml` for local infra is a natural addition once Phase 1
development starts.

## Repository structure

See [`docs/architecture/repository-structure.md`](docs/architecture/repository-structure.md).

## Contributing

See [`CLAUDE.md`](CLAUDE.md) for engineering principles, the Definition of Done, and what never to do in
this codebase.
