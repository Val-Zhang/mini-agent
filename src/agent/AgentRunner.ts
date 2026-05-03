import type { ChatMessage, ModelClient, ToolCall } from '../types.js';
import type { AgentRunEvent } from './run/events.js';
import { collectFinalResponse } from './run/collectFinalResponse.js';
import { mapSubagentProgressEvent } from './run/subagentProgress.js';
import { executeToolCallOnce, streamExecutionProgress } from './run/toolExecution.js';
import { ToolRegistry } from '../tools/core/ToolRegistry.js';
import type { ToolDefinition, ToolExecutionEvent } from '../tools/core/types.js';
import { toAssistantMessage } from './utils/messages.js';

const DEFAULT_MAX_TURNS = 24;

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

  async *run(input: string): AsyncGenerator<AgentRunEvent> {
    yield { type: 'run_started', input };
    this.history.push({ role: 'user', content: input });

    try {
      for (let turnCount = 1; turnCount <= this.maxTurns; turnCount += 1) {
        yield { type: 'model_turn_started', turnCount };

        const response = await this.model.chat(this.history, {
          tools: this.tools.list()
        });

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

        yield* this.runToolCalls(response.toolCalls);
      }

      throw new Error(`Agent loop exceeded max turns (${this.maxTurns})`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      yield { type: 'run_failed', error: message };
    }
  }

  async send(input: string): Promise<string> {
    return collectFinalResponse(this.run(input));
  }

  private async *runToolCalls(toolCalls: ToolCall[]): AsyncGenerator<AgentRunEvent> {
    for (const toolCall of toolCalls) {
      yield { type: 'tool_call_started', toolCall };
      const execution = this.executeToolCall(toolCall);
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

  private async *executeToolCall(toolCall: ToolCall): AsyncGenerator<
    Extract<AgentRunEvent, { type: 'subagent_progress' }>,
    {
      message: ChatMessage;
      event: Extract<AgentRunEvent, { type: 'tool_call_completed' }>;
    }
  > {
    return yield* streamExecutionProgress({
      execute: (emit: (event: ToolExecutionEvent) => void) =>
        executeToolCallOnce({
          toolCall,
          tool: this.tools.get(toolCall.name),
          emit
        }),
      mapProgress: (event) => mapSubagentProgressEvent(toolCall, event)
    });
  }

  getHistory(): ChatMessage[] {
    return this.history.map((message) => ({ ...message }));
  }
}
