# AI Architecture — Polar AI Commerce

## 1. Core rule

**WhatsApp is never connected directly to Claude.** Every message passes through the AI Orchestrator, a
deterministic pipeline that the AI cannot bypass:

```text
MESSAGE → IDENTITY → CUSTOMER CONTEXT → CONVERSATION CONTEXT → INTENT →
POLICY CHECK → TOOL SELECTION → CLAUDE → TOOL EXECUTION →
RESULT VALIDATION → RESPONSE GENERATION → SAFETY CHECK → WHATSAPP
```

Each stage is a plain TypeScript function/service in `packages/ai`, independently testable and observable.
Claude participates only at the `CLAUDE` step (reasoning/generation) and indirectly at `TOOL EXECUTION`
(the tool call it requests is executed by our code, never by the model itself).

## 2. AI Provider abstraction

```text
packages/ai/src/provider/
  AIProvider.ts          — interface: complete(), streamComplete(), countTokens()
  AnthropicProvider.ts    — Claude implementation (Messages API, tool use, structured output)
```

No other package imports `@anthropic-ai/sdk` directly. This is ADR-0003 (Claude as the initial provider)
combined with ADR-0007 (provider abstraction) — swapping or adding a model provider later means writing one
new adapter, not touching orchestration logic. See `docs/ai/ai-governance.md` for model/prompt versioning.

## 3. Agents

Five specialized agents, each a row in `ai.agent` with an explicit `allowed_tools` list — an agent can only
request tools on its own allow-list, enforced server-side before the tool call reaches execution (never
trust the model's self-restraint):

| Agent | Responsibility | Representative tools |
|---|---|---|
| Sales | Discovery, qualification, recommendation, comparison, objection handling | `search_products`, `compare_products`, `get_customer_preferences`, `create_cart` |
| Support | Troubleshooting, warranty, policy questions | `search_knowledge_base`, `create_support_case` |
| Order | Order status, tracking, payment status | `get_order`, `get_order_tracking` |
| CRM | Profile updates, preference inference, segmentation, event logging | `update_customer_preference`, `update_customer` |
| Insight | Cross-conversation pattern analysis for internal consumption (never customer-facing) | read-only analytics tools |

Routing between agents is a deterministic decision (based on `conversation.status` +
`conversation_intent`), made by the orchestrator — not something Claude decides for itself mid-conversation
without going through the policy layer.

## 4. Tools

Tools are the **only** way the AI touches anything outside its own reasoning. Each tool (`ai.tool` +
implementation in the owning package, e.g. `packages/commerce/src/tools/searchProducts.ts`) has:

- a typed input schema and output schema (JSON Schema, validated both directions);
- an authorization check (which agent/role may call it, on which customer's data);
- a timeout and retry policy;
- structured logging of every call to `ai.tool_execution` (input, output, status, latency);
- explicit error handling — a tool failure returns a typed error the model can react to, it never throws
  an unhandled exception into the conversation.

**Hard constraints, enforced in code, not by prompting:**

- No tool executes raw SQL. No tool gives the AI a live database connection.
- No tool can change price, stock, or apply a discount outside configured, validated bounds — that logic
  lives in the deterministic Business Rule Engine (`packages/commerce`), and a tool can only *invoke* it,
  never bypass it.
- No tool creates an order without backend validation (stock, price, payment status re-checked against
  VTEX at execution time, not trusted from earlier context).
- No tool modifies consent — that requires the dedicated `consent`-purpose tools, which write to
  `consent.customer_consent` + `consent.consent_history` atomically and emit an audit event.
- No tool returns another customer's data — every tool that takes a `customer_id` re-validates it against
  the authenticated conversation's resolved identity server-side; the model cannot supply an arbitrary
  `customer_id` and get a different customer back.

## 5. Business Rule Engine

A deterministic layer the AI calls through tools but never replaces:

```text
IF stock <= 0                          THEN product cannot be sold
IF campaign inactive                   THEN campaign cannot be offered
IF discount exceeds configured maximum THEN deny
IF marketing consent is false          THEN marketing message cannot be sent
IF customer identity is uncertain      THEN require verification
IF payment status is unknown           THEN never claim payment success
```

Implemented as plain, unit-tested TypeScript predicates/services in `packages/commerce` and `packages/crm`
(not encoded in a prompt). The AI Orchestrator's `POLICY CHECK` stage runs applicable rules *before* Claude
is invoked (to shape what's even offered as an option) and `RESULT VALIDATION` runs them again *after* tool
execution (to catch anything a tool result implies that the rules forbid stating).

## 6. Prompt architecture

Never one giant prompt. Composed from explicit, separately-sourced blocks:

```text
System Prompt
+ Agent Instructions
+ Business Rules (relevant subset)
+ Customer Context   (profile + relevant preferences, minimized)
+ Conversation Context (recent messages + rolling summary)
+ Retrieved Knowledge  (RAG chunks, PUBLISHED only, with document_id/version/chunk_id)
+ Tool Results
```

Built by `packages/ai/src/prompt/PromptComposer.ts`. Each block is independently sized/truncated so a long
conversation degrades gracefully (summary grows, raw history is bounded) instead of silently blowing the
context window or the cost budget.

PII minimization: only the fields a specific tool/turn needs are included. Example — the Sales agent
qualifying a customer sees sport profile and relevant preferences, not birth date or full address unless a
shipping-related tool is about to be called.

## 7. Memory

See Domain Model §5 for the four-layer memory model (short-term / long-term / event history / knowledge).
The Prompt Composer is the only place these four are combined; nothing else in the codebase should merge
them into a single blob.

## 8. Non-hallucination principle

If the platform doesn't know something, the agent says so. The AI must never invent price, stock, delivery
date, policy, specification, order state, payment state, or a discount. This is enforced two ways:

1. **Structurally** — price/stock/order/payment data is only ever injected into the prompt as a tool
   result carrying its own `source`/`fetched_at`; there is no path for the model to "recall" a number from
   earlier in a long conversation and restate it as current fact without a fresh tool call once it's past
   the configured freshness TTL.
2. **At the Safety Check stage** — output validation flags responses that assert a price/stock/order claim
   not traceable to a tool result in that turn (see AI Safety, `docs/ai/ai-governance.md`).

## 9. Recommendation Engine

Three explicit stages, only the last of which touches Claude:

1. **Candidate generation** (backend, deterministic) — eligible products given stock, campaign status,
   catalog rules.
2. **Ranking** (backend, deterministic-first, may incorporate a learned/AI-scored signal later) — sport,
   level, goal, price, availability, behavior, history, active campaigns.
3. **Explanation** (Claude) — turns the ranked list into natural language. Claude may only describe
   attributes present in the `ProductReference`/`ProductSnapshot`/knowledge data it was given — it cannot
   introduce a feature or claim not present in that source.

## 10. Cost & performance

- Token usage (`input_tokens`, `output_tokens`) and latency are recorded per `ai.agent_execution`.
- Conversation context is bounded (§6) specifically to control both cost and latency.
- Anomalous cost per conversation/customer/agent triggers an alert (see Observability Strategy) —
  thresholds are a Phase 6+ configuration concern, not hardcoded here.

## 11. Resilience

If Claude is unavailable: the orchestrator degrades to a scripted fallback response ("we're experiencing
delays, a specialist will follow up") and queues the conversation for retry/human handoff — it does not
fail the whole webhook pipeline. See Integration Architecture §Resilience.
