import { AgentRunner } from './AgentRunner.js';
import { SYSTEM_PROMPT } from './prompts/main.js';
import { loadSkillRegistry } from './skills/loadSkills.js';
import { loadSubagentRegistry } from './subagents/loadSubagents.js';
import { loadCompactSummary } from './context/transcriptStore.js';
import type { PermissionConfirmer } from './permissions/types.js';
import { createDefaultHookRegistry } from './hooks/defaultHooks.js';
import { createDefaultTools } from '../tools/defaultTools.js';
import type { ModelClient } from '../types.js';

export async function createAgent({
  model,
  workspaceRoot = process.cwd(),
  confirmPermission
}: {
  model: ModelClient;
  workspaceRoot?: string;
  confirmPermission?: PermissionConfirmer;
}): Promise<AgentRunner> {
  const subagentRegistry = await loadSubagentRegistry({ workspaceRoot });
  const skillRegistry = await loadSkillRegistry({ workspaceRoot });
  const compactSummary = await loadCompactSummary(workspaceRoot);

  return new AgentRunner({
    model,
    systemPrompt: SYSTEM_PROMPT,
    workspaceRoot,
    transcriptEnabled: true,
    compactSummary,
    confirmPermission,
    hooks: createDefaultHookRegistry(workspaceRoot),
    tools: createDefaultTools({
      workspaceRoot,
      skills: skillRegistry,
      subagents: subagentRegistry
        ? {
            model,
            registry: subagentRegistry
          }
        : undefined
    })
  });
}
