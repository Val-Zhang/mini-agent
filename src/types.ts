import type { ToolDefinition } from './tools/core/types.js';
export type { AgentRunEvent } from './agent/run/events.js';
export type { ContextConfig, ContextUsage, ContextUsageBreakdown, ContextUsageStatus } from './agent/context/types.js';
export type { PermissionConfirmation, PermissionConfirmer, PermissionDecision, PermissionResult } from './agent/permissions/types.js';

export type AgentMode = 'execute' | 'plan';
export type PlanStatus = 'none' | 'needs_approval' | 'approved';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: OpenAICompatibleToolCallMessage[];
  reasoning_content?: string;
}

export interface ModelClient {
  chat(messages: ChatMessage[], options?: ModelChatOptions): Promise<ModelResponse>;
  streamChat?(messages: ChatMessage[], options?: ModelChatOptions): AsyncIterable<ModelStreamEvent>;
  capabilities?(): ModelCapabilities;
}

export interface ModelChatOptions {
  tools?: ToolDefinition[];
  temperature?: number;
  signal?: AbortSignal;
}

export interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  jsonMode: boolean;
  reasoning: boolean;
}

export interface ModelResponse {
  content: string;
  toolCalls: ToolCall[];
  stopReason: string | null;
  providerMetadata?: ProviderMetadata;
  raw: unknown;
}

export type ModelStreamEvent =
  | {
      type: 'delta';
      contentDelta: string;
    }
  | {
      type: 'completed';
      response: ModelResponse;
    };

export interface ProviderMetadata {
  reasoningContent?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface OpenAICompatibleToolCallMessage {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
