import type { ToolSchema } from '../core/types.js';

export const bashSchema: ToolSchema = {
  name: 'bash',
  description: 'Run a bash command in the current workspace and return stdout, stderr, and exit code.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Bash command to run.'
      }
    },
    required: ['command'],
    additionalProperties: false
  }
};
