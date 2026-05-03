import type { AgentRunEvent } from '../../../../types.js';
import type { RendererOutput, SubagentTraceMode } from '../../types.js';
import { formatSubagentProgressSummary, formatSubagentToolCompletion } from '../../utils/subagentProgressFormatter.js';
import { CompactSubagentTracePolicy } from '../../utils/subagentTracePolicy.js';

type SubagentProgressEvent = Extract<AgentRunEvent, { type: 'subagent_progress' }>;

export function renderCompactSubagentProgress({
  output,
  event,
  traceMode,
  policy
}: {
  output: RendererOutput;
  event: SubagentProgressEvent;
  traceMode: SubagentTraceMode;
  policy: CompactSubagentTracePolicy;
}): void {
  if (traceMode === 'off') {
    return;
  }

  switch (event.phase) {
    case 'started':
      output.write(`    ↳ ${event.message}\n`);
      break;
    case 'heartbeat':
      if (!policy.shouldRender(event, traceMode)) {
        return;
      }
      output.write(`    … [${event.subagent}] ${event.message}\n`);
      break;
    case 'model_turn_started':
      if (!policy.shouldRender(event, traceMode)) {
        return;
      }
      output.write(`    … [${event.subagent}] ${event.message}\n`);
      break;
    case 'tool_call_started':
      output.write(`    · [${event.subagent}] ${event.message}\n`);
      break;
    case 'tool_call_completed': {
      const completion = formatSubagentToolCompletion(event);
      const status = completion.slice(0, 1);
      const detail = completion.slice(2);
      output.write(`      ${status} [${event.subagent}] ${detail}\n`);
      break;
    }
    case 'completed':
      output.write(`    ✓ [${event.subagent}] ${formatSubagentProgressSummary(event)}\n`);
      break;
    case 'failed':
      output.write(`    ✗ [${event.subagent}] ${formatSubagentProgressSummary(event)}\n`);
      break;
  }
}
