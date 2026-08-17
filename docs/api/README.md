# API documentation

`apps/api` (Fastify). All endpoints below except `/health*` and `/auth/login` require an
`Authorization: Bearer <sessionId>` header (see `docs/security/security-architecture.md` §1) and the
listed permission (§2 of the same doc). An OpenAPI/JSON Schema spec generated from the Fastify route
schemas is the intended long-term format once there's enough surface area to warrant it (ADR-0008); this
table is the interim source of truth.

## Health (Phase 0/1)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/health/ready` | Readiness (DB + Redis reachable) |

## Auth (Phase 2)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` → session |
| POST | `/auth/logout` | session | Revokes the presented session |
| GET | `/auth/me` | session | Returns the authenticated actor (roles + permissions) |

## Customers & identity (Phase 2)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/customers` | `customer.write` | Create a customer with one or more identities |
| POST | `/identities/resolve` | `customer.write` | Resolve identities → matched / created / ambiguous |
| GET | `/customers/:id` | `customer.read` | Fetch a customer |
| GET | `/customers/:id/timeline` | `customer.read` | Customer timeline |
| PUT | `/customers/:id/profile` | `customer.write` | Upsert profile fields |
| PUT | `/customers/:id/sport-profile` | `customer.write` | Upsert a sport profile (per sport) |
| GET | `/customers/:id/preferences` | `customer.read` | Current preferences |
| POST | `/customers/:id/preferences` | `customer.write` | Set a preference (versioned — see data model §crm) |

## Consent (Phase 2)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/customers/:id/consent` | `customer.read` | Consent status per purpose |
| POST | `/customers/:id/consent/:purpose/grant` | `customer.write` | Grant consent for a purpose |
| POST | `/customers/:id/consent/:purpose/revoke` | `customer.write` | Revoke consent for a purpose |

## LGPD data-subject rights (Phase 2)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/customers/:id/export` | `customer.delete` | Full data export |
| POST | `/customers/:id/anonymize` | `customer.delete` | Anonymize PII, keep the row |
| DELETE | `/customers/:id` | `customer.delete` | Anonymize + soft-delete (see `docs/security/security-architecture.md` §8 on retention-policy scope) |

## WhatsApp webhook (Phase 1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/webhooks/whatsapp` | Meta verify-token query params | One-time subscription verification handshake |
| POST | `/webhooks/whatsapp` | `X-Hub-Signature-256` HMAC | Inbound message/status events — verifies signature, enqueues, acks fast (see `docs/whatsapp/whatsapp-architecture.md` §3) |

## Conversations (Phase 1)

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/conversations/:id` | `conversation.read` | Fetch a conversation |
| GET | `/conversations/:id/messages` | `conversation.read` | List messages (most recent first) |
| POST | `/conversations/:id/messages` | `conversation.manage` | Admin-triggered outbound send (`{ text }`) — human handoff, not the AI response path |

## Not yet built

AI, commerce, knowledge, campaign, and analytics endpoints ship in their respective roadmap phases
(`docs/architecture/roadmap.md`). Customer segments/tags (Phase 2 remainder) are also not yet exposed.
