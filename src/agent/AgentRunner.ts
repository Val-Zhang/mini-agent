import type { ChatMessage, ModelClient, ToolCall } from '../types.js';
import { ToolRegistry } from '../tools/core/ToolRegistry.js';
import type { ToolDefinition } from '../tools/core/types.js';
import { toAssistantMessage, toToolResultMessage } from './utils/messages.js';
import { snapshotState, type LoopState, type LoopStateSnapshot } from './utils/state.js';

const DEFAULT_MAX_TURNS = 8;

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

  constructor({ model, tools = [], systemPrompt, maxTurns = DEFAULT_MAX_TURNS }: AgentRunnerOptions) {
    this.model = model;
    this.tools = new ToolRegistry(tools);
    this.maxTurns = maxTurns;
    this.history = [{ role: 'system', content: systemPrompt }];
  }

  async send(input: string): Promise<string> {
    this.history.push({ role: 'user', content: input });

    const result = await this.runLoop();
    return result.finalResponse;
  }

  async runLoop(): Promise<RunLoopResult> {
    const state: LoopState = {
      messages: this.history,
      turnCount: 0,
      transitionReason: 'user_message'
    };

    while (state.turnCount < this.maxTurns) {
      state.turnCount += 1;

      const response = await this.model.chat(state.messages, {
        tools: this.tools.list()
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
        response.toolCalls.map((toolCall) => this.executeToolCall(toolCall))
      );

      state.messages.push(...toolResults);
      state.transitionReason = 'tool_result';
    }

    throw new Error(`Agent loop exceeded max turns (${this.maxTurns})`);
  }

  private async executeToolCall(toolCall: ToolCall): Promise<ChatMessage> {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return toToolResultMessage(toolCall, `Unknown tool: ${toolCall.name}`, true);
    }

    try {
      const result = await tool.execute(toolCall.input ?? {});
      return toToolResultMessage(toolCall, String(result ?? ''));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return toToolResultMessage(toolCall, message, true);
    }
  }

  getHistory(): ChatMessage[] {
    return this.history.map((message) => ({ ...message }));
  }
}
