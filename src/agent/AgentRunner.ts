import type { AgentEvent, AgentSendOptions, ChatMessage, ModelClient, ToolCall } from '../types.js';
import { ToolRegistry } from '../tools/core/ToolRegistry.js';
import type { ToolDefinition } from '../tools/core/types.js';
import { toAssistantMessage, toToolResultMessage } from './utils/messages.js';
import { snapshotState, type LoopState, type LoopStateSnapshot } from './utils/state.js';

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

interface RunLoopResult {
  finalResponse: string;
  state: LoopStateSnapshot;
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

  async send(input: string, options: AgentSendOptions = {}): Promise<string> {
    this.history.push({ role: 'user', content: input });

    const result = await this.runLoop(options);
    return result.finalResponse;
  }

  async runLoop(options: AgentSendOptions = {}): Promise<RunLoopResult> {
    const state: LoopState = {
      messages: this.history,
      turnCount: 0,
      transitionReason: 'user_message'
    };

    while (state.turnCount < this.maxTurns) {
      state.turnCount += 1;
      emit(options, { type: 'model_turn_start', turnCount: state.turnCount });

      const response = await this.model.chat(state.messages, {
        tools: this.tools.list()
      });
      emit(options, {
        type: 'model_turn_end',
        turnCount: state.turnCount,
        toolCallCount: response.toolCalls.length,
        content: response.content,
        stopReason: response.stopReason
      });

      state.messages.push(toAssistantMessage(response));

      if (response.toolCalls.length === 0) {
        state.transitionReason = null;
        return {
          finalResponse: response.content,
          state: snapshotState(state)
        };
      }

      const toolResults = await Promise.all(
        response.toolCalls.map((toolCall) => this.executeToolCall(toolCall, options))
      );

      state.messages.push(...toolResults);
      state.transitionReason = 'tool_result';
    }

    throw new Error(`Agent loop exceeded max turns (${this.maxTurns})`);
  }

  private async executeToolCall(toolCall: ToolCall, options: AgentSendOptions): Promise<ChatMessage> {
    emit(options, { type: 'tool_call_start', toolCall });
    const startedAt = Date.now();
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      const content = `Unknown tool: ${toolCall.name}`;
      emit(options, { type: 'tool_call_end', toolCall, isError: true, content, durationMs: Date.now() - startedAt });
      return toToolResultMessage(toolCall, content, true);
    }

    try {
      const result = await tool.execute(toolCall.input ?? {});
      const content = String(result ?? '');
      emit(options, { type: 'tool_call_end', toolCall, isError: false, content, durationMs: Date.now() - startedAt });
      return toToolResultMessage(toolCall, content);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      emit(options, { type: 'tool_call_end', toolCall, isError: true, content: message, durationMs: Date.now() - startedAt });
      return toToolResultMessage(toolCall, message, true);
    }
  }

  getHistory(): ChatMessage[] {
    return this.history.map((message) => ({ ...message }));
  }
}

function emit(options: AgentSendOptions, event: AgentEvent): void {
  options.onEvent?.(event);
}
