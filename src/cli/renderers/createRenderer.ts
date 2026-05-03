import { CompactRenderer } from './compactRenderer.js';
import { SilentRenderer } from './silentRenderer.js';
import type { RendererOutput, TerminalRenderer, TraceMode } from './types.js';
import { VerboseRenderer } from './verboseRenderer.js';

export function createRenderer({
  mode = loadTraceMode(),
  output
}: {
  mode?: TraceMode;
  output: RendererOutput;
}): TerminalRenderer {
  switch (mode) {
    case 'off':
      return new SilentRenderer(output);

    case 'verbose':
      return new VerboseRenderer(output);

    case 'compact':
    default:
      return new CompactRenderer(output);
  }
}

export function loadTraceMode(env: NodeJS.ProcessEnv = process.env): TraceMode {
  const mode = env.AGENT_TRACE;

  if (mode === 'off' || mode === 'verbose' || mode === 'compact') {
    return mode;
  }

  return 'compact';
}
