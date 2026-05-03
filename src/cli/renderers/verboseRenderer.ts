import type { AgentRunEvent } from '../../types.js';
import type { RendererOutput, TerminalRenderer } from './types.js';
import { formatBlock } from './utils/text.js';

export class VerboseRenderer implements TerminalRenderer {
  constructor(private readonly output: RendererOutput) {}

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

      case 'tool_call_started':
        this.output.write(`tool> 调用 ${event.toolCall.name}\n`);
        this.output.write(formatBlock('input', JSON.stringify(event.toolCall.input, null, 2)));
        break;

      case 'tool_call_completed':
        this.output.write(`tool> ${event.toolCall.name} ${event.isError ? '失败' : '完成'} (${event.durationMs}ms)\n`);
        this.output.write(formatBlock('output', event.content));
        break;

      case 'run_completed':
        this.output.write(`agent> ${event.content}\n\n`);
        break;

      case 'run_failed':
        this.output.write(`error> ${event.error}\n\n`);
        break;
    }
  }
}
