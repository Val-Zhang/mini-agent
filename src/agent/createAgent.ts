import { AgentRunner } from './AgentRunner.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { createDefaultTools } from '../tools/defaultTools.js';
import type { ModelClient } from '../types.js';

export function createAgent({
  model,
  workspaceRoot = process.cwd()
}: {
  model: ModelClient;
  workspaceRoot?: string;
}): AgentRunner {
  return new AgentRunner({
    model,
    systemPrompt: SYSTEM_PROMPT,
    tools: createDefaultTools({ workspaceRoot })
  });
}
