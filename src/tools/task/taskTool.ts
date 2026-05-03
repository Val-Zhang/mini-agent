import { AgentRunner, loadMaxTurns } from '../../agent/AgentRunner.js';
import type { SubagentProgressPayload } from '../../agent/run/subagentProgress.js';
import type { SubagentRegistry } from '../../agent/subagents/SubagentRegistry.js';
import type { ModelClient } from '../../types.js';
import type { ToolDefinition, ToolExecutionContext } from '../core/types.js';
import { createTaskSchema } from './schema.js';

const DEFAULT_TASK_MAX_TURNS = 8;
const SUBAGENT_HEARTBEAT_MS = 5000;

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
    async execute(input: TaskInput, context?: ToolExecutionContext): Promise<string> {
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

      const startedAt = Date.now();
      let childModelTurns = 0;
      let childToolCalls = 0;
      let childFailedToolCalls = 0;

      emitSubagentProgress(context, {
        subagent: subagent.name,
        phase: 'started',
        message: `正在使用 ${subagent.name} subagent，帮你 ${input.description.trim()}`
      });

      const heartbeat = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        emitSubagentProgress(context, {
          subagent: subagent.name,
          phase: 'heartbeat',
          elapsedMs: Date.now() - startedAt,
          modelTurns: childModelTurns,
          toolCalls: childToolCalls,
          failedToolCalls: childFailedToolCalls,
          message: `仍在执行中（${elapsedSeconds}s，${childModelTurns} 轮，${childToolCalls} 次工具调用，${childFailedToolCalls} 次失败）`
        });
      }, SUBAGENT_HEARTBEAT_MS);

      try {
        for await (const event of childAgent.run(input.description)) {
          switch (event.type) {
            case 'model_turn_started':
              childModelTurns = event.turnCount;
              emitSubagentProgress(context, {
                subagent: subagent.name,
                phase: 'model_turn_started',
                turnCount: event.turnCount,
                message: `模型第 ${event.turnCount} 轮`
              });
              break;

            case 'tool_call_started':
              childToolCalls += 1;
              emitSubagentProgress(context, {
                subagent: subagent.name,
                phase: 'tool_call_started',
                toolName: event.toolCall.name,
                message: `调用 ${event.toolCall.name}`
              });
              break;

            case 'tool_call_completed':
              if (event.isError) {
                childFailedToolCalls += 1;
              }
              emitSubagentProgress(context, {
                subagent: subagent.name,
                phase: 'tool_call_completed',
                toolName: event.toolCall.name,
                durationMs: event.durationMs,
                isError: event.isError,
                message: `${event.isError ? '失败' : '完成'} ${event.toolCall.name}`
              });
              break;

            case 'run_completed':
              emitSubagentProgress(context, {
                subagent: subagent.name,
                phase: 'completed',
                elapsedMs: Date.now() - startedAt,
                modelTurns: childModelTurns,
                toolCalls: childToolCalls,
                failedToolCalls: childFailedToolCalls,
                message: `执行完成（${childModelTurns} 轮，${childToolCalls} 次工具调用，${childFailedToolCalls} 次失败）`
              });
              return `Subtask result (${subagent.name}):\n${event.content}`;

            case 'run_failed':
              emitSubagentProgress(context, {
                subagent: subagent.name,
                phase: 'failed',
                elapsedMs: Date.now() - startedAt,
                modelTurns: childModelTurns,
                toolCalls: childToolCalls,
                failedToolCalls: childFailedToolCalls,
                message: event.error
              });
              return `Error: subagent ${subagent.name} failed: ${event.error}`;

            default:
              break;
          }
        }

        return `Error: subagent ${subagent.name} ended without a final result`;
      } finally {
        clearInterval(heartbeat);
      }
    }
  };
}

function emitSubagentProgress(context: ToolExecutionContext | undefined, payload: SubagentProgressPayload): void {
  context?.emit({
    kind: 'subagent_progress',
    payload
  });
}
