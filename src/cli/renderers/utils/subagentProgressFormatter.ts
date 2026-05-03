import type { AgentRunEvent } from '../../../types.js';

type SubagentProgressEvent = Extract<AgentRunEvent, { type: 'subagent_progress' }>;

export function formatSubagentProgressSummary(event: SubagentProgressEvent): string {
  const elapsedSeconds =
    typeof event.elapsedMs === 'number' ? `${Math.max(0, Math.floor(event.elapsedMs / 1000))}s` : '?s';
  const modelTurns = event.modelTurns ?? '?';
  const toolCalls = event.toolCalls ?? '?';
  const failedToolCalls = event.failedToolCalls ?? 0;

  return `${event.phase === 'failed' ? '失败' : '完成'}（${elapsedSeconds}，${modelTurns} 轮，${toolCalls} 次工具调用，${failedToolCalls} 次失败）`;
}

export function formatSubagentToolCompletion(event: SubagentProgressEvent): string {
  const status = event.isError ? '✗' : '✓';
  const duration = typeof event.durationMs === 'number' ? ` (${event.durationMs}ms)` : '';
  return `${status} ${event.toolName ?? 'tool'}${duration}`;
}
