import type { ChatMessage, ModelClient, ToolCall } from '../types.js';
import type { AgentRunEvent } from './run/events.js';
import { collectFinalResponse } from './run/collectFinalResponse.js';
import { ToolRegistry } from '../tools/core/ToolRegistry.js';
import type { ToolDefinition } from '../tools/core/types.js';
import { toAssistantMessage, toToolResultMessage } from './utils/messages.js';

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

        for (const toolCall of response.toolCalls) {
          yield { type: 'tool_call_started', toolCall };
          const toolResult = await this.executeToolCall(toolCall);
          yield toolResult.event;
          this.history.push(toolResult.message);
        }
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

  private async executeToolCall(toolCall: ToolCall): Promise<{
    message: ChatMessage;
    event: Extract<AgentRunEvent, { type: 'tool_call_completed' }>;
  }> {
    const startedAt = Date.now();
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      const content = `Unknown tool: ${toolCall.name}`;
      return {
        message: toToolResultMessage(toolCall, content, true),
        event: {
          type: 'tool_call_completed',
          toolCall,
          isError: true,
          content,
          durationMs: Date.now() - startedAt
        }
      };
    }

    try {
      const result = await tool.execute(toolCall.input ?? {});
      const content = String(result ?? '');
      return {
        message: toToolResultMessage(toolCall, content),
        event: {
          type: 'tool_call_completed',
          toolCall,
          isError: false,
          content,
          durationMs: Date.now() - startedAt
        }
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        message: toToolResultMessage(toolCall, message, true),
        event: {
          type: 'tool_call_completed',
          toolCall,
          isError: true,
          content: message,
          durationMs: Date.now() - startedAt
        }
      };
    }
  }

  getHistory(): ChatMessage[] {
    return this.history.map((message) => ({ ...message }));
  }
}
