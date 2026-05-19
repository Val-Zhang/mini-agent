import type { AgentMode, PlanStatus, ToolCall } from '../../types.js';
import type { ContextUsage } from '../context/types.js';
import type { PermissionDecision } from '../permissions/types.js';
import type { SubagentProgressPhase } from './subagentProgress.js';

export type AgentRunEvent =
  | {
      type: 'run_started';
      input: string;
      mode: AgentMode;
    }
  | {
      type: 'mode_changed';
      mode: AgentMode;
    }
  | {
      type: 'plan_status_changed';
      status: PlanStatus;
      message: string;
    }
  | {
      type: 'implementation_started';
      message: string;
    }
  | {
      type: 'compaction_started';
      reason: string;
      before: ContextUsage;
    }
  | {
      type: 'compaction_completed';
      reason: string;
      before: ContextUsage;
      after: ContextUsage;
      summaryTokens: number;
    }
  | {
      type: 'context_usage_updated';
      usage: ContextUsage;
      message?: string;
    }
  | {
      type: 'permission_decided';
      toolCall: ToolCall;
      decision: PermissionDecision;
      reason: string;
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
