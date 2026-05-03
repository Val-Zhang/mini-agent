import type { AgentRunEvent } from '../../types.js';

export type TraceMode = 'compact' | 'verbose' | 'off';
export type SubagentTraceMode = 'compact' | 'verbose' | 'off';

export interface TerminalRenderer {
  render(event: AgentRunEvent): void;
}

export interface RendererOutput {
  write(value: string): void;
}
