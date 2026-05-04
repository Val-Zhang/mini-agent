import type { ChatMessage, ToolCall } from '../../types.js';
import type { ToolDefinition, ToolExecutionEvent } from '../../tools/core/types.js';
import { toToolResultMessage } from '../utils/messages.js';
import type { AgentRunEvent } from './events.js';

type ToolCallCompletedEvent = Extract<AgentRunEvent, { type: 'tool_call_completed' }>;

export interface ToolCallExecutionResult {
  message: ChatMessage;
  event: ToolCallCompletedEvent;
}

export function createToolCallExecutionResult({
  toolCall,
  content,
  isError,
  durationMs
}: {
  toolCall: ToolCall;
  content: string;
  isError: boolean;
  durationMs: number;
}): ToolCallExecutionResult {
  return {
    message: toToolResultMessage(toolCall, content, isError),
    event: {
      type: 'tool_call_completed',
      toolCall,
      isError,
      content,
      durationMs
    }
  };
}

export async function executeToolCallOnce({
  toolCall,
  tool,
  emit,
  signal
}: {
  toolCall: ToolCall;
  tool: ToolDefinition | undefined;
  emit: (event: ToolExecutionEvent) => void;
  signal?: AbortSignal;
}): Promise<ToolCallExecutionResult> {
  const startedAt = Date.now();

  if (!tool) {
    const content = `Unknown tool: ${toolCall.name}`;
    return createToolCallExecutionResult({
      toolCall,
      content,
      isError: true,
      durationMs: Date.now() - startedAt
    });
  }

  try {
    const result = await tool.execute(toolCall.input ?? {}, { emit, signal });
    const content = String(result ?? '');
    return createToolCallExecutionResult({
      toolCall,
      content,
      isError: false,
      durationMs: Date.now() - startedAt
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return createToolCallExecutionResult({
      toolCall,
      content: message,
      isError: true,
      durationMs: Date.now() - startedAt
    });
  }
}

export async function* streamExecutionProgress<TProgress, TResult>({
  execute,
  mapProgress
}: {
  execute: (emit: (event: ToolExecutionEvent) => void) => Promise<TResult>;
  mapProgress: (event: ToolExecutionEvent) => TProgress | null;
}): AsyncGenerator<TProgress, TResult> {
  const queue: TProgress[] = [];
  let settled = false;
  let wakeUp: (() => void) | null = null;
  let failure: unknown = null;
  let finalResult: TResult | undefined;

  const wake = () => {
    const resume = wakeUp;
    wakeUp = null;
    resume?.();
  };

  const running = execute((event) => {
    const progress = mapProgress(event);
    if (progress === null) {
      return;
    }

    queue.push(progress);
    wake();
  })
    .then((result) => {
      finalResult = result;
    })
    .catch((error: unknown) => {
      failure = error;
    })
    .finally(() => {
      settled = true;
      wake();
    });

  while (!settled || queue.length > 0) {
    while (queue.length > 0) {
      const event = queue.shift();
      if (event !== undefined) {
        yield event;
      }
    }

    if (!settled) {
      await new Promise<void>((resolve) => {
        wakeUp = resolve;
      });
    }
  }

  await running;

  if (failure) {
    throw failure;
  }

  if (finalResult === undefined) {
    throw new Error('Tool execution ended without a final result');
  }

  return finalResult;
}
