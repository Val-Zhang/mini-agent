import type { ToolCall } from '../../types.js';
import type { ToolDefinition, ToolSchema } from '../../tools/core/types.js';

interface OpenAICompatibleTool {
  type: 'function';
  function: ToolSchema;
}

export interface OpenAICompatibleToolCall {
  id?: string;
  function?: {
    name?: string;
    arguments?: unknown;
  };
}

export function toOpenAICompatibleTools(tools: ToolDefinition[] = []): OpenAICompatibleTool[] {
  return tools
    .map((tool) => tool.schema)
    .filter((schema): schema is ToolSchema => Boolean(schema))
    .map((schema) => ({
      type: 'function',
      function: schema
    }));
}

export function normalizeToolCalls(toolCalls: OpenAICompatibleToolCall[] = []): ToolCall[] {
  return toolCalls.map((toolCall, index) => ({
    id: toolCall.id ?? `call_${index}`,
    name: toolCall.function?.name ?? '',
    input: parseToolArguments(toolCall.function?.arguments)
  }));
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value !== 'string') {
    return isRecord(value) ? value : { value };
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : { value: parsed };
  } catch {
    return { raw: value };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
