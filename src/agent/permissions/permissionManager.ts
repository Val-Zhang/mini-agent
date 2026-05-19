import type { AgentMode } from '../../types.js';
import { classifyBashCommand } from './bashClassifier.js';
import type { PermissionRequest, PermissionResult } from './types.js';

const PLAN_MODE_ALLOWED_TOOLS = new Set(['read_file', 'todo_write', 'list_dir', 'glob', 'grep', 'web_fetch', 'load_skill']);
const READ_ONLY_TOOLS = new Set(['read_file', 'todo_write', 'list_dir', 'glob', 'grep', 'web_fetch', 'load_skill']);
const WRITE_TOOLS = new Set(['write_file', 'edit_file', 'remember']);

export class PermissionManager {
  check(request: PermissionRequest): PermissionResult {
    const { toolCall, mode } = request;

    if (mode === 'plan' && !PLAN_MODE_ALLOWED_TOOLS.has(toolCall.name)) {
      return {
        decision: 'deny',
        reason: `Plan mode: ${toolCall.name} is disabled. Switch to /execute to run this tool.`
      };
    }

    if (READ_ONLY_TOOLS.has(toolCall.name)) {
      return { decision: 'allow', reason: `${toolCall.name} is read-only.` };
    }

    if (WRITE_TOOLS.has(toolCall.name)) {
      if (request.planApproved) {
        return { decision: 'allow', reason: `${toolCall.name} is allowed by the approved plan.` };
      }
      return { decision: 'ask', reason: `${toolCall.name} modifies files and needs confirmation.` };
    }

    if (toolCall.name === 'bash') {
      const command = typeof toolCall.input.command === 'string' ? toolCall.input.command : '';
      return classifyBashCommand(command);
    }

    return { decision: mode === 'execute' ? 'allow' : 'deny', reason: `${toolCall.name} is allowed in execute mode.` };
  }

  visibleTools<TTool extends { name: string }>(tools: TTool[], mode: AgentMode): TTool[] {
    if (mode === 'execute') {
      return tools;
    }

    return tools.filter((tool) => PLAN_MODE_ALLOWED_TOOLS.has(tool.name));
  }
}

export function defaultPermissionManager(): PermissionManager {
  return new PermissionManager();
}
