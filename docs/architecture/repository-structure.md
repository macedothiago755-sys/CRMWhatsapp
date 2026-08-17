# Repository Structure — Polar AI Commerce

```text
polar-ai-commerce/            (repo root — currently named CRMWhatsapp on GitHub)
│
├── apps/
│   ├── web/                  Next.js admin application
│   └── api/                  Node.js/TypeScript API — webhook gateway, REST API, orchestrator host
│
├── packages/
│   ├── database/              Postgres client, migration runner, shared query utilities
│   ├── auth/                  Authentication, session, RBAC enforcement helpers
│   ├── crm/                   Customer, identity, profile, sport profile, preferences, segments, timeline
│   ├── conversation/          Conversation, message, intent, state machine, summaries
│   ├── whatsapp/              Meta WhatsApp Cloud API adapter (the only package that talks to Meta)
│   ├── vtex/                  VTEX adapter (the only package that talks to VTEX)
│   ├── ai/                    AI Orchestrator, provider abstraction, agents, tools, prompt composer
│   ├── knowledge/              Knowledge documents, versions, chunking, embeddings, RAG retrieval
│   ├── commerce/               Product references/snapshots, cart, order references, business rule engine
│   ├── campaigns/               Campaign, audience, template, execution, delivery
│   ├── analytics/               Event bus, event log, metrics
│   ├── security/                RBAC types, audit log, standardized error codes
│   └── observability/           Logging, tracing, correlation-id propagation, metrics helpers
│
├── database/
│   ├── migrations/            Versioned, reversible SQL migrations (see 0001_init.sql / .down.sql)
│   ├── seeds/                 Local/dev seed data (never production data)
│   └── schema/                Generated/reference schema snapshots (optional, for diffing)
│
├── docs/
│   ├── architecture/          System overview, domain model, data/AI/integration architecture, ADRs, roadmap
│   ├── api/                   API documentation
│   ├── data/                  Data model / ERD
│   ├── ai/                    AI governance
│   ├── security/               Security architecture
│   ├── whatsapp/                WhatsApp integration architecture
│   ├── vtex/                    VTEX integration architecture
│   └── operations/              Deployment/runbook documentation (populated from Phase 1 onward)
│
├── tests/
│   ├── unit/                  Business rules, services, validators, recommendation logic
│   ├── integration/           Postgres, Redis, VTEX, WhatsApp, Claude (against sandboxes/mocks)
│   ├── e2e/                    WhatsApp → AI → Product → Cart → Checkout → Order
│   └── ai/                     AI evaluation scenarios (see AI Governance §8)
│
├── scripts/                    One-off/operational scripts (migration helpers, seed loaders, etc.)
│
├── .env.example
├── CLAUDE.md
├── README.md
└── package.json                pnpm workspace root
```

## Rules

- Nothing is created outside this structure without updating this document — "don't create files
  arbitrarily" (master prompt §6).
- A package only imports another package through its public exports (`src/index.ts`); no deep
  cross-package relative imports.
- Domain logic never lives in `apps/web`. `apps/web` calls `apps/api`'s HTTP API only — it never imports a
  `packages/*` domain package directly, and it never talks to Postgres directly.
- `apps/api` is the composition root: it wires packages together, exposes HTTP routes, hosts the queue
  workers, and is the only app process with a database connection.
