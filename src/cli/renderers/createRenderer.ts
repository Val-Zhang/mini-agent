import { CompactRenderer } from './compact/index.js';
import { loadSubagentTraceMode, loadTraceMode } from './rendererConfig.js';
import { SilentRenderer } from './silent/index.js';
import type { RendererOutput, SubagentTraceMode, TerminalRenderer, TraceMode } from './types.js';
import { VerboseRenderer } from './verbose/index.js';

export function createRenderer({
  mode = loadTraceMode(),
  subagentTraceMode = loadSubagentTraceMode(),
  output
}: {
  mode?: TraceMode;
  subagentTraceMode?: SubagentTraceMode;
  output: RendererOutput;
}): TerminalRenderer {
  switch (mode) {
    case 'off':
      return new SilentRenderer(output);

    case 'verbose':
      return new VerboseRenderer(output, { subagentTraceMode });

    case 'compact':
    default:
      return new CompactRenderer(output, { subagentTraceMode });
  }
}

export { loadTraceMode, loadSubagentTraceMode };
