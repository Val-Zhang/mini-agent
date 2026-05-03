import type { ToolSchema } from '../core/types.js';

export const taskSchema: ToolSchema = {
  name: 'task',
  description: 'Delegate a focused subtask to a fresh child agent. Use this for isolated exploration or summarization when the main conversation should only receive the final result.',
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'The focused task for the child agent to complete.'
      }
    },
    required: ['description'],
    additionalProperties: false
  }
};
