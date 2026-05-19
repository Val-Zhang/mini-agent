import type { AgentMode, ToolCall } from '../../types.js';

export type PermissionDecision = 'allow' | 'ask' | 'deny';

export interface PermissionRequest {
  toolCall: ToolCall;
  mode: AgentMode;
  planApproved?: boolean;
}

export interface PermissionResult {
  decision: PermissionDecision;
  reason: string;
}

export interface PermissionConfirmation {
  request: PermissionRequest;
  result: PermissionResult;
}

export type PermissionConfirmer = (confirmation: PermissionConfirmation) => Promise<boolean> | boolean;
