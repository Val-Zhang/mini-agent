import type { AgentRunEvent } from '../../../../types.js';
import type { RendererOutput, SubagentTraceMode } from '../../types.js';
import { formatSubagentProgressSummary, formatSubagentToolCompletion } from '../../utils/subagentProgressFormatter.js';

type SubagentProgressEvent = Extract<AgentRunEvent, { type: 'subagent_progress' }>;

export function renderVerboseSubagentProgress({
  output,
  event,
  traceMode
}: {
  output: RendererOutput;
  event: SubagentProgressEvent;
  traceMode: SubagentTraceMode;
}): void {
  if (traceMode === 'off') {
    return;
  }

  if (traceMode === 'compact' && event.phase === 'heartbeat') {
    return;
  }

  switch (event.phase) {
    case 'tool_call_completed':
      output.write(`subagent> [${event.subagent}] ${formatSubagentToolCompletion(event)}\n`);
      break;
    case 'completed':
    case 'failed':
      output.write(`subagent> [${event.subagent}] ${formatSubagentProgressSummary(event)}\n`);
      break;
    default:
      output.write(`subagent> [${event.subagent}] ${event.message}\n`);
      break;
  }
}
