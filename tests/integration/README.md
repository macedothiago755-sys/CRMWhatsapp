# Integration tests

Tests against a real (or ephemeral, containerized) PostgreSQL instance, plus — once implemented — VTEX and
WhatsApp sandbox environments and the Claude API. See `docs/architecture/roadmap.md` for when each further
dependency's live integration tests are added.

Run with `pnpm run test:integration` (a separate command/config from `pnpm test`, since these tests need
`DATABASE_URL` pointing at a database with migrations applied — see `vitest.integration.config.ts`).
Tests run sequentially (not in parallel) since they share one database. CI
(`.github/workflows/ci.yml`) spins up Postgres (with pgvector) and Redis service containers and runs
migrations before this suite.

Current coverage:

- `tests/integration/crm/`: customer creation/lookup, identity resolution (matched / created /
  ambiguous-merge-candidate outcomes), profile and sport-profile upsert, preference history with
  `is_current` flip semantics, timeline events, consent grant/revoke, and the LGPD export/anonymize/delete
  flows — see `docs/architecture/roadmap.md` Phase 2.
- `tests/integration/conversation/`: conversation lifecycle (create/reuse/re-create after a terminal
  state, invalid transitions), message idempotency (redelivery dedupe by `provider_message_id`), and
  status-update transitions.
- `tests/integration/whatsapp/inboundProcessor.test.ts`: the full inbound pipeline
  (`apps/api/src/services/inboundWhatsAppProcessor.ts`) called directly with synthetic webhook payloads —
  identity resolution → conversation → message persistence, redelivery idempotency, and opt-out →
  consent-revocation — see `docs/architecture/roadmap.md` Phase 1. This does *not* exercise the BullMQ
  queue itself (no `REDIS_URL` needed for this file); the queue's job is retry/backoff/DLQ around this same
  function, verified manually end-to-end (see the Phase 1 delivery notes) rather than in this suite.
