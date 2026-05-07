import type { AgentRunEvent } from '../../../types.js';
import type { RendererOutput, SubagentTraceMode, TerminalRenderer } from '../types.js';
import { firstMeaningfulLine, formatBlock, MAX_MODEL_SUMMARY_CHARS } from '../utils/text.js';
import { CompactSubagentTracePolicy } from '../utils/subagentTracePolicy.js';
import { TodoTracker } from '../utils/todoTracker.js';
import { formatToolSummary } from '../utils/toolSummary.js';
import { formatContextUsageLine } from '../utils/contextUsage.js';
import { renderCompactSubagentProgress } from './utils/subagentProgress.js';

export class CompactRenderer implements TerminalRenderer {
  private readonly todoTracker = new TodoTracker();
  private readonly subagentTracePolicy = new CompactSubagentTracePolicy();
  private currentTurn = 0;
  private pendingModelDelta = '';
  private lastModelDeltaFlushAt = 0;

  constructor(
    private readonly output: RendererOutput,
    private readonly options: { subagentTraceMode?: SubagentTraceMode } = {}
  ) {}

  render(event: AgentRunEvent): void {
    switch (event.type) {
      case 'run_started':
        this.output.write('agent> 发送中...\n');
        break;

      case 'mode_changed':
        if (event.mode === 'plan') {
          this.output.write('mode> plan（只规划，不执行命令和写入）\n\n');
        } else {
          this.output.write('mode> execute（允许执行工具）\n\n');
        }
        break;

      case 'plan_status_changed':
        this.output.write(`plan> ${event.message}\n\n`);
        break;

      case 'implementation_started':
        this.output.write(`plan> ${event.message}\n\n`);
        break;

      case 'compaction_started':
        this.output.write(`compact> 开始压缩（${event.reason}） ${formatContextUsageLine(event.before)}\n`);
        break;

      case 'compaction_completed':
        this.output.write(
          `compact> 完成 ${Math.round(event.before.usagePercent * 100)}% -> ${Math.round(
            event.after.usagePercent * 100
          )}%，summary ${event.summaryTokens} tokens\n\n`
        );
        break;

      case 'context_usage_updated':
        if (event.message || event.usage.status !== 'normal') {
          this.output.write(`context> ${event.message ? `${event.message} ` : ''}${formatContextUsageLine(event.usage)}\n`);
        }
        break;

      case 'model_turn_started':
        this.flushModelDelta();
        this.currentTurn = event.turnCount;
        this.output.write(`\n[${event.turnCount}] 模型\n`);
        break;

      case 'model_turn_completed':
        this.flushModelDelta();
        this.renderModelContent(event.content);
        break;

      case 'model_turn_delta':
        this.renderModelDelta(event.contentDelta);
        break;

      case 'tool_call_started':
        this.output.write(`  · ${formatToolSummary(event.toolCall, this.todoTracker)}\n`);
        break;

      case 'tool_call_completed':
        this.todoTracker.observeResult(event.toolCall, event.content);
        this.renderToolResult(event);
        break;

      case 'subagent_progress':
        renderCompactSubagentProgress({
          output: this.output,
          event,
          traceMode: this.options.subagentTraceMode ?? 'compact',
          policy: this.subagentTracePolicy
        });
        break;

      case 'run_completed':
        this.output.write(`\nagent>\n${event.content}\n\n`);
        break;

      case 'run_failed':
        this.flushModelDelta();
        this.output.write(`error> ${event.error}\n\n`);
        break;

      case 'run_cancelled':
        this.flushModelDelta();
        this.output.write(`cancelled> ${event.reason}\n\n`);
        break;
    }
  }

  private renderModelContent(content: string): void {
    const summary = firstMeaningfulLine(content);
    if (!summary) {
      return;
    }

    this.output.write(formatBlock('model', summary, MAX_MODEL_SUMMARY_CHARS));
  }

  private renderToolResult(event: Extract<AgentRunEvent, { type: 'tool_call_completed' }>): void {
    const status = event.isError ? '✗' : '✓';
    this.output.write(`    ${status} ${event.toolCall.name} (${event.durationMs}ms)\n`);

    const todoPanel = this.todoTracker.panelFromOutput(event.content);
    if (todoPanel) {
      this.output.write(`${todoPanel}\n`);
      return;
    }

    if (event.isError || event.toolCall.name === 'todo_write') {
      this.output.write(formatBlock('output', event.content));
    }
  }

  private renderModelDelta(contentDelta: string): void {
    if (!contentDelta) {
      return;
    }

    this.pendingModelDelta += contentDelta;
    const now = Date.now();
    if (now - this.lastModelDeltaFlushAt < 100) {
      return;
    }

    this.flushModelDelta();
    this.lastModelDeltaFlushAt = now;
  }

  private flushModelDelta(): void {
    if (!this.pendingModelDelta.trim()) {
      this.pendingModelDelta = '';
      return;
    }

    this.output.write(formatBlock('model~', this.pendingModelDelta, 300));
    this.pendingModelDelta = '';
  }
}
