import type { ToolSchema } from '../core/types.js';
import type { SubagentSummary } from '../../agent/subagents/types.js';

export function createTaskSchema(subagents: SubagentSummary[]): ToolSchema {
  return {
    name: 'task',
    description: [
      'Delegate a focused subtask to a configured child agent.',
      'Use this for isolated exploration or summarization when the main conversation should only receive the final result.',
      formatSubagentList(subagents)
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        subagent: {
          type: 'string',
          enum: subagents.map((subagent) => subagent.name),
          description: 'Name of the subagent to use. Defaults to general.'
        },
        description: {
          type: 'string',
          description: 'The focused task for the child agent to complete.'
        }
      },
      required: ['description'],
      additionalProperties: false
    }
  };
}

function formatSubagentList(subagents: SubagentSummary[]): string {
  const lines = subagents.map((subagent) => `- ${subagent.name}: ${subagent.description}`);
  return ['Available subagents:', ...lines].join('\n');
}
