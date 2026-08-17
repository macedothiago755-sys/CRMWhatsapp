# API documentation

`apps/api` exposes `/health` and `/health/ready` as of Phase 0 (see
`docs/architecture/observability-strategy.md` §6). Domain endpoints (customers, conversations, campaigns,
knowledge, analytics) are documented here as each is implemented, phase by phase — see
`docs/architecture/roadmap.md`. An OpenAPI/JSON Schema spec (generated from the Fastify route schemas —
see ADR-0008) is the intended long-term format once there's enough surface area to warrant it.
