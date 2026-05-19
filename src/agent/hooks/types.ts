import type { AgentMode, ToolCall } from '../../types.js';
import type { PermissionResult } from '../permissions/types.js';
import type { ToolCallExecutionResult } from '../run/toolExecution.js';

export type HookFailurePolicy = 'warn' | 'block';
export type SessionEndStatus = 'completed' | 'failed' | 'cancelled';

export interface SessionHookContext {
  input: string;
  mode: AgentMode;
}

export interface SessionEndHookContext extends SessionHookContext {
  status: SessionEndStatus;
  message?: string;
}

export interface PreToolUseHookContext {
  toolCall: ToolCall;
  mode: AgentMode;
  permission: PermissionResult;
  planApproved?: boolean;
}

export interface PostToolUseHookContext extends PreToolUseHookContext {
  result: ToolCallExecutionResult;
}

export interface PreToolUseHookResult {
  action?: 'continue' | 'block';
  reason?: string;
}

export interface AgentHook {
  name: string;
  failurePolicy?: HookFailurePolicy;
  onSessionStart?(context: SessionHookContext): Promise<void> | void;
  onSessionEnd?(context: SessionEndHookContext): Promise<void> | void;
  onPreToolUse?(context: PreToolUseHookContext): Promise<PreToolUseHookResult | void> | PreToolUseHookResult | void;
  onPostToolUse?(context: PostToolUseHookContext): Promise<void> | void;
}
