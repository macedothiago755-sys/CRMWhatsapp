# ADR-0003: Claude (Anthropic) as the initial AI provider

## Status
Accepted

## Context
The platform needs a language model for intent understanding, conversation, recommendation explanation,
summarization, and tool-use-driven agent orchestration, with support for structured outputs and reliable
tool calling.

## Decision
Use the Anthropic Claude API as the initial (not necessarily only, see ADR-0007) AI provider, integrated
via a dedicated `AnthropicProvider` behind the `AIProvider` interface in `packages/ai`.

## Rationale
- Strong native tool-use / structured-output support, which this architecture depends on heavily (the AI
  never acts except through typed tools — see `docs/architecture/ai-architecture.md` §4).
- Directly named as the project's AI foundation in the governing product brief.

## Consequences
- Model/endpoint specifics must be verified against current Anthropic documentation at implementation
  time, not assumed from training data (master prompt §79–80) — particularly model IDs and API
  parameters, which change over time.
- All prompt/version/cost governance (`docs/ai/ai-governance.md`) is designed provider-agnostically so a
  future second provider doesn't require rearchitecting.

## Alternatives considered
- **Multi-provider from day one** — rejected: adds abstraction overhead before there's a second concrete
  provider to abstract over; the `AIProvider` interface (ADR-0007) keeps this option open without paying
  for it now.
