import { AgentRunner, loadMaxTurns } from '../../agent/AgentRunner.js';
import type { ModelClient } from '../../types.js';
import type { ToolDefinition } from '../core/types.js';
import { taskSchema } from './schema.js';

const DEFAULT_TASK_MAX_TURNS = 8;

interface TaskInput extends Record<string, unknown> {
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
  systemPrompt,
  maxTurns = loadTaskMaxTurns()
}: {
  model: ModelClient;
  createTools: () => ToolDefinition[];
  systemPrompt: string;
  maxTurns?: number;
}): ToolDefinition<TaskInput> {
  return {
    name: 'task',
    schema: taskSchema,
    async execute(input: TaskInput): Promise<string> {
      if (typeof input.description !== 'string' || input.description.trim() === '') {
        return 'Error: description is required for task action';
      }

      const childAgent = new AgentRunner({
        model,
        tools: createTools(),
        systemPrompt,
        maxTurns
      });

      const result = await childAgent.send(input.description);
      return `Subtask result:\n${result}`;
    }
  };
}
