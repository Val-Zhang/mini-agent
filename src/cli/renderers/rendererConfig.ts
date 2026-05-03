import type { SubagentTraceMode, TraceMode } from './types.js';

export function loadTraceMode(env: NodeJS.ProcessEnv = process.env): TraceMode {
  return parseMode(env.AGENT_TRACE);
}

export function loadSubagentTraceMode(env: NodeJS.ProcessEnv = process.env): SubagentTraceMode {
  return parseMode(env.AGENT_SUBAGENT_TRACE);
}

function parseMode(value: string | undefined): 'off' | 'verbose' | 'compact' {
  if (value === 'off' || value === 'verbose' || value === 'compact') {
    return value;
  }

  return 'compact';
}
