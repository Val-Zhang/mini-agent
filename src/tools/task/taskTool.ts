import { AgentRunner, loadMaxTurns } from '../../agent/AgentRunner.js';
import type { SubagentRegistry } from '../../agent/subagents/SubagentRegistry.js';
import type { ModelClient } from '../../types.js';
import type { ToolDefinition } from '../core/types.js';
import { createTaskSchema } from './schema.js';

const DEFAULT_TASK_MAX_TURNS = 8;

interface TaskInput extends Record<string, unknown> {
  subagent?: string;
  description?: string;
}

export function loadTaskMaxTurns(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.AGENT_TASK_MAX_TURNS;
  if (!value) {
    return Math.min(DEFAULT_TASK_MAX_TURNS, loadMaxTurns(env));
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return Math.min(DEFAULT_TASK_MAX_TURNS, loadMaxTurns(env));
  }

  return parsed;
}

export function createTaskTool({
  model,
  createTools,
  subagents,
  maxTurns = loadTaskMaxTurns()
}: {
  model: ModelClient;
  createTools: (options?: { allowlist?: string[] }) => ToolDefinition[];
  subagents: SubagentRegistry;
  maxTurns?: number;
}): ToolDefinition<TaskInput> {
  return {
    name: 'task',
    schema: createTaskSchema(subagents.summaries()),
    async execute(input: TaskInput): Promise<string> {
      if (typeof input.description !== 'string' || input.description.trim() === '') {
        return 'Error: description is required for task action';
      }

      const subagentName = input.subagent ?? subagents.getDefault().name;
      const subagent = subagents.get(subagentName);
      if (!subagent) {
        return `Error: unknown subagent ${subagentName}. Available subagents: ${subagents.availableNames().join(', ')}`;
      }

      const childAgent = new AgentRunner({
        model,
        tools: createTools({ allowlist: subagent.tools }),
        systemPrompt: subagent.prompt,
        maxTurns: Math.min(subagent.maxTurns, maxTurns)
      });

      const result = await childAgent.send(input.description);
      return `Subtask result (${subagent.name}):\n${result}`;
    }
  };
}
