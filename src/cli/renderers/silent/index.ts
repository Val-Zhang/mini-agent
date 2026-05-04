import type { AgentRunEvent } from '../../../types.js';
import type { RendererOutput, TerminalRenderer } from '../types.js';

export class SilentRenderer implements TerminalRenderer {
  constructor(private readonly output: RendererOutput) {}

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
