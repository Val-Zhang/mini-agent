import type { AgentEvent } from '../../types.js';
import type { RendererOutput, TerminalRenderer } from './types.js';
import { formatBlock } from './utils/text.js';

export class VerboseRenderer implements TerminalRenderer {
  constructor(private readonly output: RendererOutput) {}

  renderStart(): void {
    this.output.write('agent> 发送中...\n');
  }

  renderEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'model_turn_start':
        this.output.write(`trace> 模型第 ${event.turnCount} 轮思考中...\n`);
        break;

      case 'model_turn_end':
        this.output.write(`trace> 模型第 ${event.turnCount} 轮结束`);
        if (event.stopReason) {
          this.output.write(` (${event.stopReason})`);
        }
        this.output.write('\n');
        if (event.content.trim()) {
          this.output.write(formatBlock('model', event.content));
        }
        if (event.toolCallCount > 0) {
          this.output.write(`trace> 模型请求 ${event.toolCallCount} 个工具调用\n`);
        }
        break;

      case 'tool_call_start':
        this.output.write(`tool> 调用 ${event.toolCall.name}\n`);
        this.output.write(formatBlock('input', JSON.stringify(event.toolCall.input, null, 2)));
        break;

      case 'tool_call_end':
        this.output.write(`tool> ${event.toolCall.name} ${event.isError ? '失败' : '完成'} (${event.durationMs}ms)\n`);
        this.output.write(formatBlock('output', event.content));
        break;
    }
  }

  renderFinal(reply: string): void {
    this.output.write(`agent> ${reply}\n\n`);
  }

  renderError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.output.write(`error> ${errorMessage}\n\n`);
  }
}
