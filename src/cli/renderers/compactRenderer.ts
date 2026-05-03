import type { AgentRunEvent } from '../../types.js';
import type { RendererOutput, SubagentTraceMode, TerminalRenderer } from './types.js';
import { firstMeaningfulLine, formatBlock, MAX_MODEL_SUMMARY_CHARS } from './utils/text.js';
import { formatSubagentProgressSummary, formatSubagentToolCompletion } from './utils/subagentProgressFormatter.js';
import { CompactSubagentTracePolicy } from './utils/subagentTracePolicy.js';
import { TodoTracker } from './utils/todoTracker.js';
import { formatToolSummary } from './utils/toolSummary.js';

export class CompactRenderer implements TerminalRenderer {
  private readonly todoTracker = new TodoTracker();
  private readonly subagentTracePolicy = new CompactSubagentTracePolicy();
  private currentTurn = 0;

  constructor(
    private readonly output: RendererOutput,
    private readonly options: { subagentTraceMode?: SubagentTraceMode } = {}
  ) {}

  render(event: AgentRunEvent): void {
    switch (event.type) {
      case 'run_started':
        this.output.write('agent> 发送中...\n');
        break;

      case 'model_turn_started':
        this.currentTurn = event.turnCount;
        this.output.write(`\n[${event.turnCount}] 模型\n`);
        break;

      case 'model_turn_completed':
        this.renderModelContent(event.content);
        break;

      case 'tool_call_started':
        this.output.write(`  · ${formatToolSummary(event.toolCall, this.todoTracker)}\n`);
        break;

      case 'tool_call_completed':
        this.todoTracker.observeResult(event.toolCall, event.content);
        this.renderToolResult(event);
        break;

      case 'subagent_progress':
        this.renderSubagentProgress(event);
        break;

      case 'run_completed':
        this.output.write(`\nagent>\n${event.content}\n\n`);
        break;

      case 'run_failed':
        this.output.write(`error> ${event.error}\n\n`);
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

  private renderSubagentProgress(event: Extract<AgentRunEvent, { type: 'subagent_progress' }>): void {
    const subagentTraceMode = this.options.subagentTraceMode ?? 'compact';
    if (subagentTraceMode === 'off') {
      return;
    }

    switch (event.phase) {
      case 'started':
        this.output.write(`    ↳ ${event.message}\n`);
        break;
      case 'heartbeat':
        if (!this.subagentTracePolicy.shouldRender(event, subagentTraceMode)) {
          return;
        }
        this.output.write(`    … [${event.subagent}] ${event.message}\n`);
        break;
      case 'model_turn_started':
        if (!this.subagentTracePolicy.shouldRender(event, subagentTraceMode)) {
          return;
        }
        this.output.write(`    … [${event.subagent}] ${event.message}\n`);
        break;
      case 'tool_call_started':
        this.output.write(`    · [${event.subagent}] ${event.message}\n`);
        break;
      case 'tool_call_completed': {
        const completion = formatSubagentToolCompletion(event);
        const status = completion.slice(0, 1);
        const detail = completion.slice(2);
        this.output.write(`      ${status} [${event.subagent}] ${detail}\n`);
        break;
      }
      case 'completed':
        this.output.write(`    ✓ [${event.subagent}] ${formatSubagentProgressSummary(event)}\n`);
        break;
      case 'failed':
        this.output.write(`    ✗ [${event.subagent}] ${formatSubagentProgressSummary(event)}\n`);
        break;
    }
  }
}
