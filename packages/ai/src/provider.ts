/**
 * AIProvider abstraction — see docs/architecture/adr/ADR-0007-ai-provider-abstraction.md.
 * `AnthropicProvider` (the Claude implementation) is added in Phase 3; no other
 * package should import a model vendor SDK directly.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCallRequest {
  toolName: string;
  input: Record<string, unknown>;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AICompletionRequest {
  systemPrompt: string;
  messages: AIMessage[];
  tools: ToolDefinition[];
  maxTokens: number;
}

export interface AICompletionResult {
  content: string;
  toolCalls: ToolCallRequest[];
  inputTokens: number;
  outputTokens: number;
  model: string;
  modelVersion: string | undefined;
}

export interface AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
  countTokens(text: string): Promise<number>;
}
