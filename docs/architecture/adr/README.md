# Architecture Decision Records

| ADR | Decision |
|---|---|
| [0001](ADR-0001-postgresql.md) | PostgreSQL as the primary datastore |
| [0002](ADR-0002-modular-monolith.md) | Modular monolith over microservices at launch |
| [0003](ADR-0003-claude-ai-provider.md) | Claude (Anthropic) as the initial AI provider |
| [0004](ADR-0004-vtex-transactional-sor.md) | VTEX remains the transactional System of Record |
| [0005](ADR-0005-meta-cloud-api.md) | Meta WhatsApp Business Platform (Cloud API) as the messaging channel |
| [0006](ADR-0006-pgvector.md) | pgvector for RAG embeddings |
| [0007](ADR-0007-ai-provider-abstraction.md) | `AIProvider` abstraction over the model vendor |
| [0008](ADR-0008-api-and-tooling-stack.md) | API framework, ORM/migrations, logging, and test tooling |
| [0009](ADR-0009-immutable-prompt-versioning.md) | Prompts are immutable, versioned rows |
| [0010](ADR-0010-single-event-log.md) | One append-only event table, not three parallel ones |
| [0011](ADR-0011-immutable-internal-customer-id.md) | Immutable internal `customer_id` as the only cross-context identity key |

New ADRs follow this template: Status, Context, Decision, Rationale, Consequences, Alternatives considered.
Number sequentially; never renumber or delete a historical ADR — mark it Superseded and link forward
instead.
