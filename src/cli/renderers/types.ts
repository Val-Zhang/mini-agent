import type { AgentEvent } from '../../types.js';

export type TraceMode = 'compact' | 'verbose' | 'off';

export interface TerminalRenderer {
  renderStart(message: string): void;
  renderEvent(event: AgentEvent): void;
  renderFinal(reply: string): void;
  renderError(error: unknown): void;
}

export interface RendererOutput {
  write(value: string): void;
}
