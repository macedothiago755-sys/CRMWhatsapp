# Integration tests

Tests against real (or ephemeral, containerized) dependencies: PostgreSQL, Redis, and — once implemented —
VTEX and WhatsApp sandbox environments, and the Claude API. See
`docs/architecture/roadmap.md` for when each dependency's live integration tests are added; Phase 0 ships
no live external calls yet, so this directory is currently empty beyond this note.

CI (`.github/workflows/ci.yml`) spins up Postgres and Redis service containers for this suite.
