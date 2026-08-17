# Development Roadmap — Polar AI Commerce

Phased delivery per master prompt §68–70. Each phase, when it starts, gets: objective, components,
dependencies, risks, acceptance criteria — defined at the start of that phase's work, not speculatively
here. This roadmap fixes the *sequence and scope boundaries* only.

## Phase 0 — Architecture & Foundation ✅ delivered

- Architecture documentation (this `docs/architecture/`, `docs/data/`, `docs/ai/`, `docs/security/`,
  `docs/whatsapp/`, `docs/vtex/` tree), ADRs, ERD.
- Repository/monorepo scaffolding, TypeScript strict config, initial PostgreSQL migration (all bounded
  contexts' schema), health checks, structured logging, CI, test framework.
- No external integrations are called live yet (WhatsApp/VTEX/Claude adapters exist as typed interfaces
  and are covered by contract tests / mocks, not live credentials).

## Phase 1 — WhatsApp

- Live Meta Cloud API integration: webhook verification, inbound/outbound messaging, delivery/read status,
  opt-in/opt-out.
- Requires: Meta Business Account + WhatsApp Business number provisioned (Product Owner, pending decision
  — see `docs/whatsapp/whatsapp-architecture.md` §5).

## Phase 2 — CRM ✅ delivered (core), segments/tags pending

- Delivered: customer creation, identity resolution (matched / created / ambiguous-merge-candidate —
  merge review itself is a UI/workflow concern for the admin app, not yet built), profile, sport profile,
  versioned preferences, timeline, full consent lifecycle, LGPD data-subject rights
  (export/anonymize/delete), and admin authentication (email/password + RBAC + server-side revocable
  sessions) — see `docs/api/README.md` for the endpoint catalog and `tests/integration/crm/` for coverage.
- Not yet built: customer segments/tags read/write API (schema exists — `crm.customer_segment`,
  `crm.customer_segment_membership`, `crm.customer_tag` — no service/routes yet), and the admin-app UI
  itself (Customer 360 screens, merge-candidate review queue) — those land with the Admin Application work
  alongside/after Phase 3, not as a Phase 2 blocker.

## Phase 3 — AI Orchestrator

- Full orchestration pipeline, agents, tool catalog, prompt composer, AI safety controls, evaluation suite
  baseline.
- Requires: Anthropic API access.

## Phase 4 — Knowledge / RAG

- Document lifecycle, chunking, embeddings (pgvector), retrieval, ranking, source-cited responses.

## Phase 5 — VTEX Commerce

- Live VTEX integration: catalog, pricing, inventory, cart, checkout, order services; AI commerce tools
  wired to real data.
- Requires: VTEX credentials/account details (pending decision — see `docs/vtex/vtex-architecture.md` §5).

## Phase 6 — Analytics

- Event-driven metrics: service, commercial, and AI metrics (master prompt §30–31); Customer 360 views;
  admin dashboard data layer.

## Phase 7 — AI Insights

- Cross-conversation pattern analysis agent producing evidence-backed, confidence-scored insights (master
  prompt §51–52).

## Phase 8 — Campaigns & Automation

- Segment-driven WhatsApp campaigns, gated by consent and frequency rules; CRM automation rules routed
  through the Consent Service.

## Sequencing rules

- No phase's live external integration work starts before its named pending decision is resolved by the
  Product Owner.
- Each phase follows: explain objective → list components/dependencies/risks → define acceptance criteria
  → implement → test → review → document (master prompt §69).
- A phase is not "done" until the Definition of Done in `CLAUDE.md` is met — code, tests, error handling,
  logging, security review, documentation, migrations, API docs, observability, acceptance criteria all
  satisfied.
