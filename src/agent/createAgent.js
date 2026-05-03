import { AgentRunner } from './AgentRunner.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { createDefaultTools } from '../tools/defaultTools.js';

export function createAgent({ model, workspaceRoot = process.cwd() }) {
  return new AgentRunner({
    model,
    systemPrompt: SYSTEM_PROMPT,
    tools: createDefaultTools({ workspaceRoot })
  });
}
