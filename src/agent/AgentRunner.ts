import type { AgentMode, ChatMessage, ModelClient, ModelResponse, ToolCall } from '../types.js';
import type { AgentRunEvent } from './run/events.js';
import { collectFinalResponse } from './run/collectFinalResponse.js';
import { mapSubagentProgressEvent } from './run/subagentProgress.js';
import { createToolCallExecutionResult, executeToolCallOnce, streamExecutionProgress } from './run/toolExecution.js';
import { blockedToolMessage, isToolAllowedInMode, toolsForMode, withModeSystemPrompt } from './mode/policy.js';
import { ToolRegistry } from '../tools/core/ToolRegistry.js';
import type { ToolDefinition, ToolExecutionEvent } from '../tools/core/types.js';
import { toAssistantMessage } from './utils/messages.js';

const DEFAULT_MAX_TURNS = 24;
const DEFAULT_MODE: AgentMode = 'execute';

export function loadMaxTurns(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.AGENT_MAX_TURNS;
  if (!value) {
    return DEFAULT_MAX_TURNS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_MAX_TURNS;
  }

  return parsed;
}

interface AgentRunnerOptions {
  model: ModelClient;
  tools?: ToolDefinition[];
  systemPrompt: string;
  maxTurns?: number;
}

interface RunOptions {
  signal?: AbortSignal;
  mode?: AgentMode;
}

export class AgentRunner {
  private readonly model: ModelClient;
  private readonly tools: ToolRegistry;
  private readonly maxTurns: number;
  private readonly history: ChatMessage[];

  constructor({ model, tools = [], systemPrompt, maxTurns = loadMaxTurns() }: AgentRunnerOptions) {
    this.model = model;
    this.tools = new ToolRegistry(tools);
    this.maxTurns = maxTurns;
    this.history = [{ role: 'system', content: systemPrompt }];
  }

  async *run(input: string, options: RunOptions = {}): AsyncGenerator<AgentRunEvent> {
    const signal = options.signal;
    const mode = options.mode ?? DEFAULT_MODE;
    yield { type: 'run_started', input, mode };
    if (signal?.aborted) {
      yield { type: 'run_cancelled', reason: cancellationReason(signal) };
      return;
    }

    this.history.push({ role: 'user', content: input });

    try {
      for (let turnCount = 1; turnCount <= this.maxTurns; turnCount += 1) {
        assertNotAborted(signal);
        yield { type: 'model_turn_started', turnCount };
        const turn = this.executeModelTurn(turnCount, mode, signal);
        let response: ModelResponse | undefined;
        while (true) {
          const next = await turn.next();
          if (next.done) {
            response = next.value;
            break;
          }

          yield next.value;
        }

        if (!response) {
          throw new Error(`Model turn ended without a response (turn ${turnCount})`);
        }

        yield {
          type: 'model_turn_completed',
          turnCount,
          content: response.content,
          stopReason: response.stopReason,
          toolCalls: response.toolCalls
        };

        this.history.push(toAssistantMessage(response));

        if (response.toolCalls.length === 0) {
          yield { type: 'run_completed', content: response.content };
          return;
        }

        yield* this.runToolCalls(response.toolCalls, mode, signal);
      }

      throw new Error(`Agent loop exceeded max turns (${this.maxTurns})`);
    } catch (error: unknown) {
      if (isAbortError(error, signal)) {
        yield { type: 'run_cancelled', reason: cancellationReason(signal) };
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      yield { type: 'run_failed', error: message };
    }
  }

  async send(input: string, options: RunOptions = {}): Promise<string> {
    return collectFinalResponse(this.run(input, options));
  }

  private async *executeModelTurn(
    turnCount: number,
    mode: AgentMode,
    signal?: AbortSignal
  ): AsyncGenerator<Extract<AgentRunEvent, { type: 'model_turn_delta' }>, ModelResponse> {
    const tools = toolsForMode(this.tools.list(), mode);
    const messages = withModeSystemPrompt(this.history, mode);

    if (!this.model.streamChat) {
      return this.model.chat(messages, {
        tools,
        signal
      });
    }

    let response: ModelResponse | undefined;
    for await (const event of this.model.streamChat(messages, {
      tools,
      signal
    })) {
      if (event.type === 'delta') {
        if (event.contentDelta) {
          yield { type: 'model_turn_delta', turnCount, contentDelta: event.contentDelta };
        }
        continue;
      }

      response = event.response;
    }

    if (!response) {
      throw new Error(`Stream ended without final response (turn ${turnCount})`);
    }

    return response;
  }

  private async *runToolCalls(
    toolCalls: ToolCall[],
    mode: AgentMode,
    signal?: AbortSignal
  ): AsyncGenerator<AgentRunEvent> {
    for (const toolCall of toolCalls) {
      assertNotAborted(signal);
      yield { type: 'tool_call_started', toolCall };
      const execution = this.executeToolCall(toolCall, mode, signal);
      let toolResult:
        | {
            message: ChatMessage;
            event: Extract<AgentRunEvent, { type: 'tool_call_completed' }>;
          }
        | undefined;

      while (true) {
        const next = await execution.next();
        if (next.done) {
          toolResult = next.value;
          break;
        }

        yield next.value;
      }

      if (!toolResult) {
        throw new Error(`Tool execution ended without result: ${toolCall.name}`);
      }

      yield toolResult.event;
      this.history.push(toolResult.message);
    }
  }

  private async *executeToolCall(toolCall: ToolCall, mode: AgentMode, signal?: AbortSignal): AsyncGenerator<
    Extract<AgentRunEvent, { type: 'subagent_progress' }>,
    {
      message: ChatMessage;
      event: Extract<AgentRunEvent, { type: 'tool_call_completed' }>;
    }
  > {
    if (!isToolAllowedInMode(toolCall.name, mode)) {
      const content = blockedToolMessage(toolCall.name, mode);
      return createToolCallExecutionResult({
        toolCall,
        content,
        isError: true,
        durationMs: 0
      });
    }

    return yield* streamExecutionProgress({
      execute: (emit: (event: ToolExecutionEvent) => void) =>
        executeToolCallOnce({
          toolCall,
          tool: this.tools.get(toolCall.name),
          emit,
          signal
        }),
      mapProgress: (event) => mapSubagentProgressEvent(toolCall, event)
    });
  }

  getHistory(): ChatMessage[] {
    return this.history.map((message) => ({ ...message }));
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error(cancellationReason(signal));
  }
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  return false;
}

function cancellationReason(signal?: AbortSignal): string {
  const reason = signal?.reason;
  if (typeof reason === 'string' && reason.trim()) {
    return reason;
  }

  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return 'Run cancelled by user';
}
