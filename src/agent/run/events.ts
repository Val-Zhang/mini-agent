import type { ToolCall } from '../../types.js';

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
      type: 'run_completed';
      content: string;
    }
  | {
      type: 'run_failed';
      error: string;
    };
