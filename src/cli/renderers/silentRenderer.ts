import type { AgentEvent } from '../../types.js';
import type { RendererOutput, TerminalRenderer } from './types.js';

export class SilentRenderer implements TerminalRenderer {
  constructor(private readonly output: RendererOutput) {}

  renderStart(): void {
    this.output.write('agent> 发送中...\n');
  }

  renderEvent(_event: AgentEvent): void {}

  renderFinal(reply: string): void {
    this.output.write(`agent> ${reply}\n\n`);
  }

  renderError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.output.write(`error> ${errorMessage}\n\n`);
  }
}
