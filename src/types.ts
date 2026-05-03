import type { ToolDefinition } from './tools/core/types.js';

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
  capabilities?(): ModelCapabilities;
}

export interface ModelChatOptions {
  tools?: ToolDefinition[];
  temperature?: number;
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

export interface ProviderMetadata {
  reasoningContent?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AgentEvent =
  | {
      type: 'model_turn_start';
      turnCount: number;
    }
  | {
      type: 'model_turn_end';
      turnCount: number;
      toolCallCount: number;
      content: string;
      stopReason: string | null;
    }
  | {
      type: 'tool_call_start';
      toolCall: ToolCall;
    }
  | {
      type: 'tool_call_end';
      toolCall: ToolCall;
      isError: boolean;
      content: string;
      durationMs: number;
    };

export interface AgentSendOptions {
  onEvent?: (event: AgentEvent) => void;
}

export interface OpenAICompatibleToolCallMessage {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
