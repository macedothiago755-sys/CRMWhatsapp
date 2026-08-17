# ADR-0009: Prompts are immutable, versioned rows — never edited in place

## Status
Accepted

## Context
AI governance requires that every AI response be traceable to the exact prompt that produced it, and that
prompt changes be rollback-safe (master prompt §33, §89–90).

## Decision
`ai.prompt_version` rows are treated as immutable once created: a prompt change always inserts a new
`(agent_id, version)` row rather than updating `content` on an existing one. `ai.agent_execution.prompt_version`
records exactly which version produced a given response.

## Rationale
- Guarantees historical `agent_execution` rows remain accurate forever — an in-place edit would silently
  rewrite what "v3" meant for all past executions that used it.
- Makes rollback trivial: point the active agent config back at a previous `prompt_version` row, no data
  migration required.
- Enables the AI evaluation suite to diff behavior between two concrete, frozen prompt versions.

## Consequences
- Requires application-level discipline (or a DB trigger, as future hardening) to prevent `UPDATE`s to
  `content` on existing rows — enforced procedurally at Phase 3 when the prompt-authoring admin UI ships.
- Prompt iteration produces a growing table of versions; acceptable, and useful as an audit trail — pruning
  policy (if any) is a retention-policy decision, not a default-delete one.

## Alternatives considered
- **Mutable prompt text with a separate changelog table** — rejected: reintroduces the exact "what
  actually produced this response, historically" ambiguity the audit requirement forbids.
