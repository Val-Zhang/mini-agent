import type { ToolSchema } from '../core/types.js';

export const rememberSchema: ToolSchema = {
  name: 'remember',
  description:
    'Save a durable user preference, project fact, or workflow note for future sessions. Use only for stable information that should persist beyond the current conversation.',
  parameters: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['project_fact', 'user_preference', 'workflow_note'],
        description: 'The memory scope: project_fact, user_preference, or workflow_note.'
      },
      content: {
        type: 'string',
        description: 'The concise memory content to save. Do not include transient task details.'
      }
    },
    required: ['scope', 'content'],
    additionalProperties: false
  }
};
