# Environment Strategy — Polar AI Commerce

## 1. Environments

```text
development   local machine / ephemeral cloud dev container — synthetic or anonymized data only
staging       pre-production, mirrors production config — sandbox external credentials (VTEX/Meta test accounts)
production    live customer data, live WhatsApp number, live VTEX account
```

- Production credentials are never used locally. `staging`/`development` point at sandbox/test accounts for
  Meta and VTEX wherever those platforms offer one; where they don't, staging talks to production-read-only
  or heavily rate-limited/mocked adapters instead of a shared live account.
- Each environment has its own database. No environment reads or writes another environment's database.

## 2. Configuration

All environment-specific values are environment variables, documented (names only, no real values) in
`.env.example` at the repo root. Required categories:

```text
DATABASE_URL
REDIS_URL
ANTHROPIC_API_KEY
WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WEBHOOK_VERIFY_TOKEN, WHATSAPP_APP_SECRET
VTEX_ACCOUNT_NAME, VTEX_ENVIRONMENT, VTEX_APP_KEY, VTEX_APP_TOKEN
S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
SESSION_SECRET / JWT_SIGNING_KEY
OTEL_EXPORTER_OTLP_ENDPOINT
SENTRY_DSN
LOG_LEVEL
```

Production values live in the deployment platform's secrets manager; never in git, never in a `.env` file
committed anywhere, never in a CI log.

## 3. Migration safety

- Every schema change is a migration under `database/migrations/`, applied in order, tracked in a
  `schema_migrations` table (introduced by the migration tool selected in ADR-0005).
- Migrations are written to be reversible where practical (`*.down.sql` companion), and are tested against
  a disposable database in CI before merge.
- **No manual production schema edits, ever.** No destructive migration (`DROP TABLE`, destructive
  `ALTER`) runs against production without an explicit, logged confirmation step outside normal CI/CD
  automation — this is a process gate, not just a code convention.
- Migrations never run automatically against production as part of a routine deploy without a discrete,
  reviewed "apply migration" action.

## 4. CI/CD

GitHub Actions (see `.github/workflows/ci.yml`): install → typecheck → lint → unit tests → integration
tests (against ephemeral Postgres/Redis service containers) → build. Deployment pipelines (staging/prod)
are defined once a hosting decision is made (§5, pending) — not invented speculatively here.

## 5. Pending decisions

Per master prompt §76 — infrastructure provider, domain, corporate authentication/SSO provider, and
internal access policy are Product Owner decisions not yet made. This repo's environment strategy is
written to be portable across reasonable choices (any Postgres-compatible host, any Node.js hosting
target) so none of these block Phase 0–3 development.
