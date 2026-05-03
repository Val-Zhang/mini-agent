import type { ToolCall } from '../../types.js';
import type { SubagentProgressPhase } from './subagentProgress.js';

export type AgentRunEvent =
  | {
      type: 'run_started';
      input: string;
    }
  | {
      type: 'model_turn_started';
      turnCount: number;
    }
  | {
      type: 'model_turn_completed';
      turnCount: number;
      content: string;
      stopReason: string | null;
      toolCalls: ToolCall[];
    }
  | {
      type: 'model_turn_delta';
      turnCount: number;
      contentDelta: string;
    }
  | {
      type: 'tool_call_started';
      toolCall: ToolCall;
    }
  | {
      type: 'tool_call_completed';
      toolCall: ToolCall;
      isError: boolean;
      content: string;
      durationMs: number;
    }
  | {
      type: 'subagent_progress';
      toolCall: ToolCall;
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
  | {
      type: 'run_completed';
      content: string;
    }
  | {
      type: 'run_failed';
      error: string;
    }
  | {
      type: 'run_cancelled';
      reason: string;
    };
