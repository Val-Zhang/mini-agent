import type { AgentMode, ChatMessage, ModelClient, ModelResponse, ToolCall } from '../types.js';
import type { AgentRunEvent } from './run/events.js';
import { ContextManager } from './context/contextManager.js';
import { loadContextConfig } from './context/config.js';
import type { ContextConfig, ContextUsage } from './context/types.js';
import { loadCompactSummary, saveCompactSummary, TranscriptStore } from './context/transcriptStore.js';
import { buildCompactionPrompt } from './context/compactionPrompt.js';
import { ApproximateTokenEstimator } from './context/tokenEstimator.js';
import { collectFinalResponse } from './run/collectFinalResponse.js';
import { mapSubagentProgressEvent } from './run/subagentProgress.js';
import { createToolCallExecutionResult, executeToolCallOnce, streamExecutionProgress } from './run/toolExecution.js';
import { blockedToolMessage, isToolAllowedInMode, toolsForMode } from './mode/policy.js';
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
  contextConfig?: ContextConfig;
  workspaceRoot?: string;
  transcriptEnabled?: boolean;
  compactSummary?: string;
}

interface RunOptions {
  signal?: AbortSignal;
  mode?: AgentMode;
}

interface CompactOptions {
  mode?: AgentMode;
  reason?: string;
  workspaceRoot?: string;
  preserveLastMessages?: number;
}

interface CompactionResult {
  reason: string;
  before: ContextUsage;
  after: ContextUsage;
  summary: string;
  summaryTokens: number;
}

export class AgentRunner {
  private readonly model: ModelClient;
  private readonly tools: ToolRegistry;
  private readonly maxTurns: number;
  private readonly history: ChatMessage[];
  private readonly context: ContextManager;
  private readonly transcript?: TranscriptStore;
  private readonly workspaceRoot?: string;
  private compactSummary: string;
  private compactedMessageCount: number;

  constructor({
    model,
    tools = [],
    systemPrompt,
    maxTurns = loadMaxTurns(),
    contextConfig = loadContextConfig(),
    workspaceRoot,
    transcriptEnabled = false,
    compactSummary = ''
  }: AgentRunnerOptions) {
    this.model = model;
    this.tools = new ToolRegistry(tools);
    this.maxTurns = maxTurns;
    this.history = [{ role: 'system', content: systemPrompt }];
    this.context = new ContextManager({ config: contextConfig });
    this.workspaceRoot = workspaceRoot;
    this.transcript = transcriptEnabled && workspaceRoot ? new TranscriptStore(workspaceRoot) : undefined;
    this.compactSummary = compactSummary;
    this.compactedMessageCount = compactSummary ? this.history.length : 0;
  }

  async *run(input: string, options: RunOptions = {}): AsyncGenerator<AgentRunEvent> {
    const signal = options.signal;
    const mode = options.mode ?? DEFAULT_MODE;
    yield { type: 'run_started', input, mode };
    if (signal?.aborted) {
      yield { type: 'run_cancelled', reason: cancellationReason(signal) };
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: input };
    this.history.push(userMessage);
    await this.appendTranscriptMessage(userMessage);

    try {
      for (let turnCount = 1; turnCount <= this.maxTurns; turnCount += 1) {
        assertNotAborted(signal);
        let usage = this.getContextUsage(mode);
        if (usage.usagePercent >= this.context.getConfig().compactThreshold && this.canCompact()) {
          yield { type: 'compaction_started', reason: 'auto', before: usage };
          const result = await this.compact({ mode, reason: 'auto', workspaceRoot: this.workspaceRoot, preserveLastMessages: 1 });
          yield {
            type: 'compaction_completed',
            reason: result.reason,
            before: result.before,
            after: result.after,
            summaryTokens: result.summaryTokens
          };
          usage = result.after;
        }
        yield { type: 'context_usage_updated', usage };
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

        const assistantMessage = toAssistantMessage(response);
        this.history.push(assistantMessage);
        await this.appendTranscriptMessage(assistantMessage);

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
    const { messages } = this.context.buildActiveContext({
      history: this.activeHistoryForContext(),
      tools,
      mode,
      compactSummary: this.compactSummary
    });

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
      await this.appendTranscriptMessage(toolResult.message);
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

  getContextUsage(mode: AgentMode = DEFAULT_MODE): ContextUsage {
    const tools = toolsForMode(this.tools.list(), mode);
    return this.context.estimate({
      history: this.activeHistoryForContext(),
      tools,
      mode,
      compactSummary: this.compactSummary
    });
  }

  getCompactSummary(): string {
    return this.compactSummary;
  }

  async compact({
    mode = DEFAULT_MODE,
    reason = 'manual',
    workspaceRoot,
    preserveLastMessages = 0
  }: CompactOptions = {}): Promise<CompactionResult> {
    const before = this.getContextUsage(mode);
    const prompt = buildCompactionPrompt(this.history, this.context.getConfig().summaryMaxTokens);
    const response = await this.model.chat(
      [
        { role: 'system', content: 'You summarize agent transcripts for context compaction.' },
        { role: 'user', content: prompt }
      ],
      { tools: [] }
    );
    const summary = response.content.trim();
    this.compactSummary = summary;
    this.compactedMessageCount = Math.max(1, this.history.length - Math.max(0, preserveLastMessages));

    if (workspaceRoot) {
      await saveCompactSummary(workspaceRoot, summary);
    }
    if (this.transcript) {
      await this.transcript.appendCompact(summary, this.history.length);
    }

    const after = this.getContextUsage(mode);
    const summaryTokens = new ApproximateTokenEstimator().countText(summary);
    return { reason, before, after, summary, summaryTokens };
  }

  async reloadCompactSummary(workspaceRoot: string): Promise<void> {
    this.compactSummary = await loadCompactSummary(workspaceRoot);
    this.compactedMessageCount = this.compactSummary ? this.history.length : 0;
  }

  private canCompact(): boolean {
    return this.history.length > 1 && this.compactedMessageCount < this.history.length;
  }

  private activeHistoryForContext(): ChatMessage[] {
    if (!this.compactSummary || this.compactedMessageCount <= 0) {
      return this.history;
    }

    return [this.history[0], ...this.history.slice(this.compactedMessageCount)].filter(Boolean);
  }

  private async appendTranscriptMessage(message: ChatMessage): Promise<void> {
    if (!this.transcript) {
      return;
    }

    await this.transcript.appendMessage(message);
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
