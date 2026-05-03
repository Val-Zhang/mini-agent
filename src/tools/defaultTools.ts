import { createBashTool } from './bash/bashTool.js';
import { createFilesystemTools } from './filesystem/filesystemTools.js';
import { createTaskTool } from './task/taskTool.js';
import { createTodoTool } from './todo/todoTool.js';
import { createPathSandbox } from './core/pathSandbox.js';
import type { ToolDefinition } from './core/types.js';
import { TASK_SYSTEM_PROMPT } from '../agent/prompts/task.js';
import type { ModelClient } from '../types.js';

export function createDefaultTools({
  workspaceRoot,
  subagents
}: {
  workspaceRoot: string;
  subagents?: {
    enabled: boolean;
    model: ModelClient;
  };
}): ToolDefinition[] {
  const sandbox = createPathSandbox(workspaceRoot);
  const createBaseTools = () => [
    createBashTool({ workspaceRoot: sandbox.root }),
    ...createFilesystemTools({ sandbox }),
    createTodoTool({ workspaceRoot: sandbox.root })
  ];

  const tools = createBaseTools();

  if (subagents?.enabled) {
    tools.push(
      createTaskTool({
        model: subagents.model,
        createTools: createBaseTools,
        systemPrompt: TASK_SYSTEM_PROMPT
      })
    );
  }

  return tools;
}
