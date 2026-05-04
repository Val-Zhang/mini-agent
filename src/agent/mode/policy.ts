import type { AgentMode, ChatMessage } from '../../types.js';
import type { ToolDefinition } from '../../tools/core/types.js';
import { PLAN_MODE_SYSTEM_PROMPT } from '../prompts/plan.js';

const PLAN_MODE_ALLOWED_TOOLS = new Set(['read_file', 'todo_write', 'list_dir', 'glob', 'grep']);

export function isToolAllowedInMode(toolName: string, mode: AgentMode): boolean {
  if (mode === 'execute') {
    return true;
  }

  return PLAN_MODE_ALLOWED_TOOLS.has(toolName);
}

export function toolsForMode(tools: ToolDefinition[], mode: AgentMode): ToolDefinition[] {
  if (mode === 'execute') {
    return tools;
  }

  return tools.filter((tool) => isToolAllowedInMode(tool.name, mode));
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
