import type { ToolCall } from '../../types.js';
import type { ToolExecutionEvent } from '../../tools/core/types.js';
import type { AgentRunEvent } from './events.js';

export type SubagentProgressPhase =
  | 'started'
  | 'heartbeat'
  | 'model_turn_started'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'completed'
  | 'failed';

export interface SubagentProgressPayload {
  subagent: string;
  phase: SubagentProgressPhase;
  message: string;
  turnCount?: number;
  toolName?: string;
  durationMs?: number;
  isError?: boolean;
  elapsedMs?: number;
  modelTurns?: number;
  toolCalls?: number;
  failedToolCalls?: number;
}

export function mapSubagentProgressEvent(
  toolCall: ToolCall,
  event: ToolExecutionEvent
): Extract<AgentRunEvent, { type: 'subagent_progress' }> | null {
  if (event.kind !== 'subagent_progress') {
    return null;
  }

  const payload = parseSubagentProgressPayload(event.payload);
  if (!payload) {
    return null;
  }

  return {
    type: 'subagent_progress',
    toolCall,
    ...payload
  };
}

export function parseSubagentProgressPayload(value: unknown): SubagentProgressPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const subagent = asString(value.subagent);
  const phase = asSubagentPhase(value.phase);
  const message = asString(value.message);
  if (!subagent || !phase || !message) {
    return null;
  }

  return {
    subagent,
    phase,
    message,
    turnCount: asNumber(value.turnCount),
    toolName: asString(value.toolName),
    durationMs: asNumber(value.durationMs),
    isError: asBoolean(value.isError),
    elapsedMs: asNumber(value.elapsedMs),
    modelTurns: asNumber(value.modelTurns),
    toolCalls: asNumber(value.toolCalls),
    failedToolCalls: asNumber(value.failedToolCalls)
  };
}

function asSubagentPhase(value: unknown): SubagentProgressPhase | null {
  const phase = asString(value);
  if (
    phase === 'started' ||
    phase === 'heartbeat' ||
    phase === 'model_turn_started' ||
    phase === 'tool_call_started' ||
    phase === 'tool_call_completed' ||
    phase === 'completed' ||
    phase === 'failed'
  ) {
    return phase;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
