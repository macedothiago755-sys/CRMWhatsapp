# CLAUDE.md — Polar AI Commerce

This file governs how Claude (or any engineer) works in this repository. It is a condensed operating
manual derived from the project's master prompt. When in doubt, the full architecture docs in `docs/`
and the ADRs in `docs/architecture/adr/` are authoritative for *why*; this file is authoritative for
*how to behave while working here*.

## What this is

Polar AI Commerce is a proprietary Customer Data Platform + WhatsApp CRM + AI Commerce platform — not a
chatbot with a database attached. Read `docs/architecture/system-overview.md` first.

## Non-negotiable principles

1. **Data ownership** — Polar's PostgreSQL database is the System of Record for customer identity,
   consent, profile, preferences, and conversation history.
2. **VTEX is the transactional System of Record.** Catalog, price, stock, cart, checkout, payment, order
   status live in VTEX. Never build a second "official" order/inventory system.
3. **Claude is not a System of Record.** It never decides price, stock, discounts, policy, consent, or
   identity — it calls typed tools; the backend enforces every rule.
4. **AI-first, deterministic where it matters.** Understanding/generation → AI. Rules, pricing, stock,
   discounts, consent, security → deterministic backend code.
5. **Privacy by design (LGPD).** Minimize what reaches the model. Every consent/data-subject action is
   auditable.

Priority order when principles conflict (master prompt §93):

```text
Security > Data integrity > Business correctness > Reliability > Observability > Maintainability >
Performance > Features
```

A feature that works but compromises data, security, or commercial integrity is **not done**.

## Never do this

- Create microservices without a concrete need (see ADR-0002).
- Put business logic in the frontend, or let the frontend touch the database directly.
- Hardcode secrets, anywhere, ever. Use `.env.example` for names only.
- Put unnecessary personal data into an AI prompt.
- Let the AI run SQL, or give it a live database connection.
- Let Claude bypass the Business Rule Engine (price/stock/discount/consent decisions).
- Duplicate the full VTEX catalog or treat CRM order references as authoritative.
- Use vector search for stock/price lookups.
- Rely on prompting alone for security — enforce in code.
- Send marketing messages without checking consent.
- Run a destructive migration against production without an explicit, logged confirmation step.
- Make an external API call without a timeout.
- Invent an external API endpoint/payload shape from memory — confirm against current docs (Anthropic,
  Meta, VTEX) before implementing or changing an integration.

## How to approach a change

For anything with architectural, security, data, payments, LGPD, WhatsApp, or VTEX impact:

```text
Impact Analysis → Architecture → Implementation Plan → Implementation → Tests → Validation
```

If ambiguity in the request could compromise architecture, security, data integrity, LGPD compliance, or
correctness of a WhatsApp/VTEX/payment flow — stop and surface the decision (use `AskUserQuestion` or ask
in chat) rather than guessing. Small, isolated changes can be implemented directly.

When presenting options for a genuinely open decision, give Option A / Option B with pros, cons, risk,
cost, and an explicit recommendation — don't hide the trade-offs.

## Definition of Done

A feature is not complete until:

```text
[ ] Requirements understood            [ ] Logging
[ ] Architecture reviewed              [ ] Monitoring
[ ] Code implemented                   [ ] Error handling
[ ] Unit tests                         [ ] Documentation updated
[ ] Integration tests                  [ ] Migration (if schema changed)
[ ] E2E (if applicable)                [ ] Rollback strategy
[ ] Security reviewed                  [ ] Acceptance criteria met
```

"Works on my machine" is not done.

## Repository layout

See `docs/architecture/repository-structure.md` for the full map and the rules about package boundaries
(a package only imports another via its public `src/index.ts`; `apps/web` never touches the database or a
domain package directly — only `apps/api`'s HTTP surface).

## Database

- One schema per bounded context (`crm`, `conversation`, `ai`, `commerce`, `knowledge`, `campaign`,
  `consent`, `analytics`, `security`). See `docs/data/data-model.md` for the full catalog and
  `database/migrations/` for the executable schema.
- Every schema change is a new migration file, forward + down. Never edit a merged migration; never touch
  production schema by hand.
- `crm.customer.id` (UUID) is the only cross-context customer key. Never join on phone/email.

## AI

- Every inbound message flows through the full orchestrator pipeline
  (`docs/architecture/ai-architecture.md` §1) — WhatsApp is never wired directly to Claude.
- New/changed prompts get a new `ai.prompt_version` row (never edit `content` in place — ADR-0009) and
  should run against the `tests/ai` evaluation suite before shipping.
- Tools are the only way AI touches other systems; every tool needs input/output schemas, authorization,
  timeout, retry policy, and logging (`docs/architecture/ai-architecture.md` §4).

## Development phases

Follow the sequence in `docs/architecture/roadmap.md` (Phase 0 Architecture → 1 WhatsApp → 2 CRM → 3 AI
Orchestrator → 4 Knowledge/RAG → 5 VTEX Commerce → 6 Analytics → 7 AI Insights → 8 Campaigns). Don't build
Phase N+1 functionality as a side effect of a Phase N task without calling it out.

## Commands

```bash
pnpm install         # install workspace dependencies
pnpm dev              # run apps/api in dev mode
pnpm build            # build all packages/apps
pnpm typecheck         # typecheck all packages/apps
pnpm test              # run the test suite (vitest)
pnpm migrate            # apply pending database migrations
```

## Pending business decisions this repo does not invent values for

Meta Business Account / WhatsApp number, VTEX credentials and enabled API scope, LGPD retention windows
per data category, hosting/infra provider, corporate SSO provider. See
`docs/architecture/environment-strategy.md` §5 and the relevant integration doc's "Pending decisions"
section. Do not fabricate these — flag them.
