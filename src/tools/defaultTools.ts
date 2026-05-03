import { createBashTool } from './bash/bashTool.js';
import { createFilesystemTools } from './filesystem/filesystemTools.js';
import { createTodoTool } from './todo/todoTool.js';
import { createPathSandbox } from './core/pathSandbox.js';
import type { ToolDefinition } from './core/types.js';

export function createDefaultTools({ workspaceRoot }: { workspaceRoot: string }): ToolDefinition[] {
  const sandbox = createPathSandbox(workspaceRoot);

  return [
    createBashTool({ workspaceRoot: sandbox.root }),
    ...createFilesystemTools({ sandbox }),
    createTodoTool({ workspaceRoot: sandbox.root })
  ];
}
