import { AgentRunner } from './AgentRunner.js';
import { SYSTEM_PROMPT } from './prompts/main.js';
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

  return new AgentRunner({
    model,
    systemPrompt: SYSTEM_PROMPT,
    tools: createDefaultTools({
      workspaceRoot,
      subagents: subagentRegistry
        ? {
            model,
            registry: subagentRegistry
          }
        : undefined
    })
  });
}
