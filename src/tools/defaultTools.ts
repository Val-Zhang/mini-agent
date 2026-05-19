import { createBashTool } from './bash/bashTool.js';
import { createDiscoveryTools } from './discovery/discoveryTools.js';
import { createFilesystemTools } from './filesystem/filesystemTools.js';
import { createLoadSkillTool } from './skills/loadSkillTool.js';
import { createRememberTool } from './memory/rememberTool.js';
import { createRunSkillTool } from './skills/runSkillTool.js';
import { createTaskTool } from './task/taskTool.js';
import { createTodoTool } from './todo/todoTool.js';
import { createPathSandbox } from './core/pathSandbox.js';
import type { ToolDefinition } from './core/types.js';
import type { SkillRegistry } from '../agent/skills/SkillRegistry.js';
import type { SubagentRegistry } from '../agent/subagents/SubagentRegistry.js';
import type { ModelClient } from '../types.js';
import { MemoryManager } from '../agent/memory/memoryManager.js';

export function createDefaultTools({
  workspaceRoot,
  skills,
  subagents
}: {
  workspaceRoot: string;
  skills: SkillRegistry;
  subagents?: {
    model: ModelClient;
    registry: SubagentRegistry;
  };
}): ToolDefinition[] {
  const sandbox = createPathSandbox(workspaceRoot);
  const memory = new MemoryManager(sandbox.root);
  const createBaseTools = ({ allowlist }: { allowlist?: string[] } = {}) => {
    const tools = [
      ...createDiscoveryTools({ sandbox }),
      createBashTool({ workspaceRoot: sandbox.root }),
      ...createFilesystemTools({ sandbox }),
      createTodoTool({ workspaceRoot: sandbox.root }),
      createRememberTool({ memory }),
      createLoadSkillTool({ skills }),
      createRunSkillTool({ skills })
    ];

    if (!allowlist) {
      return tools;
    }

    const allowed = new Set(allowlist);
    const knownToolNames = new Set(tools.map((tool) => tool.name));
    const unknownTools = [...allowed].filter((toolName) => !knownToolNames.has(toolName));
    if (unknownTools.length > 0) {
      throw new Error(`Unknown subagent tools: ${unknownTools.join(', ')}`);
    }

    return tools.filter((tool) => allowed.has(tool.name));
  };

  const tools = createBaseTools();

  if (subagents) {
    for (const subagent of subagents.registry.list()) {
      createBaseTools({ allowlist: subagent.tools });
    }

    tools.push(
      createTaskTool({
        model: subagents.model,
        createTools: createBaseTools,
        subagents: subagents.registry
      })
    );
  }

  return tools;
}
