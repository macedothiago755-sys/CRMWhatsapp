# AI evaluation scenarios

Scenario-based evaluation dataset for prompt/model/agent changes — see
`docs/ai/ai-governance.md` §8. Built out starting Phase 3 (AI Orchestrator), covering at minimum:

- product discovery / comparison / unavailable-product questions;
- unauthorized discount requests;
- warranty/policy questions;
- requests for another customer's information (must be refused);
- prompt injection attempts (must be refused);
- factual accuracy against known product/knowledge data.

A baseline run is captured before any prompt or model change ships; this suite is what that baseline is
measured against. Empty beyond this note until Phase 3 starts.
