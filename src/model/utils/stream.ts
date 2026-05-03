import type { ModelResponse, ModelStreamEvent } from '../../types.js';
import { normalizeToolCalls } from './openAICompatible.js';
import type { OpenAICompatibleToolCall } from './openAICompatible.js';

interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: unknown;
      tool_calls?: unknown[];
      reasoning_content?: unknown;
    };
    finish_reason?: string | null;
  }>;
}

interface StreamToolCallState {
  id: string;
  name: string;
  arguments: string;
}

interface StreamToolCallDelta {
  index?: unknown;
  id?: unknown;
  function?: {
    name?: unknown;
    arguments?: unknown;
  };
}

export async function* streamChatCompletionResponse(response: Response): AsyncGenerator<ModelStreamEvent> {
  if (!response.body) {
    throw new Error('Stream response body is empty');
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffered = '';

  let content = '';
  let stopReason: string | null = null;
  let reasoningContent = '';
  const toolCalls = new Map<number, StreamToolCallState>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffered += decoder.decode(value, { stream: true });
    const frames = buffered.split('\n\n');
    buffered = frames.pop() ?? '';

    for (const frame of frames) {
      const payload = readDataFrame(frame);
      if (!payload) {
        continue;
      }

      if (payload === '[DONE]') {
        yield {
          type: 'completed',
          response: toModelResponse({
            content,
            stopReason,
            reasoningContent,
            toolCalls: [...toolCalls.entries()]
          })
        };
        return;
      }

      const chunk = JSON.parse(payload) as StreamChunk;
      const choice = chunk.choices?.[0];
      if (!choice) {
        continue;
      }

      const delta = choice.delta ?? {};
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content;
        yield { type: 'delta', contentDelta: delta.content };
      }

      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
        reasoningContent += delta.reasoning_content;
      }

      if (Array.isArray(delta.tool_calls)) {
        mergeToolCallDeltas(toolCalls, delta.tool_calls as StreamToolCallDelta[]);
      }

      if (typeof choice.finish_reason === 'string' || choice.finish_reason === null) {
        stopReason = choice.finish_reason;
      }
    }
  }

  yield {
    type: 'completed',
    response: toModelResponse({
      content,
      stopReason,
      reasoningContent,
      toolCalls: [...toolCalls.entries()]
    })
  };
}

function readDataFrame(frame: string): string | null {
  const lines = frame
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'));

  if (lines.length === 0) {
    return null;
  }

  return lines.map((line) => line.slice(5).trim()).join('');
}

function mergeToolCallDeltas(
  state: Map<number, StreamToolCallState>,
  deltas: StreamToolCallDelta[]
): void {
  for (const delta of deltas) {
    const index = typeof delta.index === 'number' ? delta.index : 0;
    const current = state.get(index) ?? { id: `call_${index}`, name: '', arguments: '' };

    if (typeof delta.id === 'string' && delta.id) {
      current.id = delta.id;
    }
    if (typeof delta.function?.name === 'string' && delta.function.name) {
      current.name = delta.function.name;
    }
    if (typeof delta.function?.arguments === 'string' && delta.function.arguments) {
      current.arguments += delta.function.arguments;
    }

    state.set(index, current);
  }
}

function toModelResponse({
  content,
  stopReason,
  reasoningContent,
  toolCalls
}: {
  content: string;
  stopReason: string | null;
  reasoningContent: string;
  toolCalls: Array<[number, StreamToolCallState]>;
}): ModelResponse {
  const sortedToolCalls = toolCalls
    .sort((a, b) => a[0] - b[0])
    .map(([, toolCall]) => ({
      id: toolCall.id,
      function: {
        name: toolCall.name,
        arguments: toolCall.arguments
      }
    })) satisfies OpenAICompatibleToolCall[];

  return {
    content,
    toolCalls: normalizeToolCalls(sortedToolCalls),
    stopReason,
    providerMetadata: {
      reasoningContent: reasoningContent || undefined
    },
    raw: {
      stream: true
    }
  };
}
