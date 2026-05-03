import { AgentRunner } from './AgentRunner.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';

export function createAgent({ model }) {
  return new AgentRunner({ model, systemPrompt: SYSTEM_PROMPT });
}
