import type { AgentMode, ChatMessage } from '../../types.js';
import type { ToolDefinition } from '../../tools/core/types.js';
import { PermissionManager } from '../permissions/permissionManager.js';
import { PLAN_MODE_SYSTEM_PROMPT } from '../prompts/plan.js';

const permissionManager = new PermissionManager();

export function isToolAllowedInMode(toolName: string, mode: AgentMode): boolean {
  if (mode === 'execute') {
    return true;
  }

  return permissionManager.visibleTools([{ name: toolName }], mode).length > 0;
}

export function toolsForMode(tools: ToolDefinition[], mode: AgentMode): ToolDefinition[] {
  if (mode === 'execute') {
    return tools;
  }

  return permissionManager.visibleTools(tools, mode);
}

export function withModeSystemPrompt(history: ChatMessage[], mode: AgentMode): ChatMessage[] {
  if (mode === 'execute') {
    return history;
  }

  return [
    ...history.slice(0, 1),
    {
      role: 'system',
      content: PLAN_MODE_SYSTEM_PROMPT
    },
    ...history.slice(1)
  ];
}

export function blockedToolMessage(toolName: string, mode: AgentMode): string {
  if (mode !== 'plan') {
    return `Tool ${toolName} is disabled in ${mode} mode.`;
  }

  return `Plan mode: ${toolName} is disabled. Switch to /execute to run this tool.`;
}
