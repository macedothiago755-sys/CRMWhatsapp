# ADR-0007: AIProvider abstraction over the model vendor

## Status
Accepted

## Context
Claude is the initial model (ADR-0003), but the master prompt requires the system not be hard-coupled to
one vendor, to allow future model routing/comparison without rewriting the application.

## Decision
Define an `AIProvider` interface in `packages/ai` (`complete`, `streamComplete`, `countTokens`, tool-use
support) with `AnthropicProvider` as the sole concrete implementation today. No other package imports the
Anthropic SDK directly.

## Rationale
- Keeps orchestration, prompt composition, tool execution, and governance logic vendor-neutral.
- Adding a second provider later is "write one adapter class," not "touch every call site."

## Consequences
- A small amount of upfront abstraction cost (one interface, one adapter) versus calling the SDK directly.
- The interface must be kept honest to Claude's actual capabilities (tool use, structured output) — it
  should not be designed against a lowest-common-denominator that would cripple day-one functionality.

## Alternatives considered
- **Call the Anthropic SDK directly throughout `packages/ai`** — rejected: cheaper today, but violates
  the explicit model-routing requirement (master prompt §87) and would make a future provider addition a
  much larger refactor.
