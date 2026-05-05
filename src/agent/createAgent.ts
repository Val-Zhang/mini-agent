import { AgentRunner } from './AgentRunner.js';
import { SYSTEM_PROMPT } from './prompts/main.js';
import { loadSkillRegistry } from './skills/loadSkills.js';
import { loadSubagentRegistry } from './subagents/loadSubagents.js';
import { createDefaultTools } from '../tools/defaultTools.js';
import type { ModelClient } from '../types.js';

export async function createAgent({
  model,
  workspaceRoot = process.cwd()
}: {
  model: ModelClient;
  workspaceRoot?: string;
}): Promise<AgentRunner> {
  const subagentRegistry = await loadSubagentRegistry({ workspaceRoot });
  const skillRegistry = await loadSkillRegistry({ workspaceRoot });

  return new AgentRunner({
    model,
    systemPrompt: SYSTEM_PROMPT,
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
