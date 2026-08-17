/**
 * Agent catalog — see docs/architecture/ai-architecture.md §3.
 * Each agent's `allowedTools` is enforced server-side before a requested tool
 * call is executed; the model's own restraint is never trusted alone.
 */
export const AGENT_KEYS = ["sales", "support", "order", "crm", "insight"] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  allowedTools: string[];
  active: boolean;
}

export function isToolAllowedForAgent(agent: AgentDefinition, toolName: string): boolean {
  return agent.active && agent.allowedTools.includes(toolName);
}
