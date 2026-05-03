import type { AgentRunEvent } from '../../../types.js';
import type { RendererOutput, SubagentTraceMode, TerminalRenderer } from '../types.js';
import { formatBlock } from '../utils/text.js';
import { formatToolSummary } from '../utils/toolSummary.js';
import { TodoTracker } from '../utils/todoTracker.js';
import { renderVerboseSubagentProgress } from './utils/subagentProgress.js';

export class VerboseRenderer implements TerminalRenderer {
  private readonly todoTracker = new TodoTracker();

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
        this.output.write(`trace> 模型第 ${event.turnCount} 轮思考中...\n`);
        break;

      case 'model_turn_completed':
        this.output.write(`trace> 模型第 ${event.turnCount} 轮结束`);
        if (event.stopReason) {
          this.output.write(` (${event.stopReason})`);
        }
        this.output.write('\n');
        if (event.content.trim()) {
          this.output.write(formatBlock('model', event.content));
        }
        if (event.toolCalls.length > 0) {
          this.output.write(`trace> 模型请求 ${event.toolCalls.length} 个工具调用\n`);
        }
        break;

      case 'model_turn_delta':
        if (event.contentDelta) {
          this.output.write(formatBlock('delta', event.contentDelta, 500));
        }
        break;

      case 'tool_call_started':
        this.output.write(`tool> 调用 ${event.toolCall.name}\n`);
        if (event.toolCall.name === 'task') {
          this.output.write(`trace> ${formatToolSummary(event.toolCall, this.todoTracker)}\n`);
        }
        this.output.write(formatBlock('input', JSON.stringify(event.toolCall.input, null, 2)));
        break;

      case 'tool_call_completed':
        this.todoTracker.observeResult(event.toolCall, event.content);
        this.output.write(`tool> ${event.toolCall.name} ${event.isError ? '失败' : '完成'} (${event.durationMs}ms)\n`);
        this.output.write(formatBlock('output', event.content));
        break;

      case 'subagent_progress':
        renderVerboseSubagentProgress({
          output: this.output,
          event,
          traceMode: this.options.subagentTraceMode ?? 'compact'
        });
        break;

      case 'run_completed':
        this.output.write(`agent> ${event.content}\n\n`);
        break;

      case 'run_failed':
        this.output.write(`error> ${event.error}\n\n`);
        break;

      case 'run_cancelled':
        this.output.write(`cancelled> ${event.reason}\n\n`);
        break;
    }
  }
}
