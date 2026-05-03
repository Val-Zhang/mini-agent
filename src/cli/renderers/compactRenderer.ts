import type { AgentEvent } from '../../types.js';
import type { RendererOutput, TerminalRenderer } from './types.js';
import { firstMeaningfulLine, formatBlock, MAX_MODEL_SUMMARY_CHARS } from './utils/text.js';
import { TodoTracker } from './utils/todoTracker.js';
import { formatToolSummary } from './utils/toolSummary.js';

export class CompactRenderer implements TerminalRenderer {
  private readonly todoTracker = new TodoTracker();
  private currentTurn = 0;

  constructor(private readonly output: RendererOutput) {}

  renderStart(): void {
    this.output.write('agent> 发送中...\n');
  }

  renderEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'model_turn_start':
        this.currentTurn = event.turnCount;
        this.output.write(`\n[${event.turnCount}] 模型\n`);
        break;

      case 'model_turn_end':
        this.renderModelContent(event.content);
        break;

      case 'tool_call_start':
        this.output.write(`  · ${formatToolSummary(event.toolCall, this.todoTracker)}\n`);
        break;

      case 'tool_call_end':
        this.todoTracker.observeResult(event.toolCall, event.content);
        this.renderToolResult(event);
        break;
    }
  }

  renderFinal(reply: string): void {
    this.output.write(`\nagent>\n${reply}\n\n`);
  }

  renderError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.output.write(`error> ${errorMessage}\n\n`);
  }

  private renderModelContent(content: string): void {
    const summary = firstMeaningfulLine(content);
    if (!summary) {
      return;
    }

    this.output.write(formatBlock('model', summary, MAX_MODEL_SUMMARY_CHARS));
  }

  private renderToolResult(event: Extract<AgentEvent, { type: 'tool_call_end' }>): void {
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
}
