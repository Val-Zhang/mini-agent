import type { ModelResponse } from '../../types.js';
import { normalizeToolCalls } from './openAICompatible.js';
import type { OpenAICompatibleToolCall } from './openAICompatible.js';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
      tool_calls?: unknown[];
      reasoning_content?: unknown;
    };
    finish_reason?: string | null;
  }>;
}

export function normalizeChatCompletionResponse(data: unknown): ModelResponse {
  const response = data as ChatCompletionResponse;
  const choice = response.choices?.[0];
  const message = choice?.message;
  const content = message?.content ?? '';

  if (typeof content !== 'string') {
    throw new Error('Local model response did not include choices[0].message.content');
  }

  return {
    content,
    toolCalls: normalizeToolCalls((message?.tool_calls ?? []) as OpenAICompatibleToolCall[]),
    stopReason: choice?.finish_reason ?? null,
    providerMetadata: {
      reasoningContent:
        typeof message?.reasoning_content === 'string' ? message.reasoning_content : undefined
    },
    raw: data
  };
}
