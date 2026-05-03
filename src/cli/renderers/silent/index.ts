import type { AgentRunEvent } from '../../../types.js';
import type { RendererOutput, TerminalRenderer } from '../types.js';

export class SilentRenderer implements TerminalRenderer {
  constructor(private readonly output: RendererOutput) {}

  render(event: AgentRunEvent): void {
    switch (event.type) {
      case 'run_started':
        this.output.write('agent> 发送中...\n');
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
