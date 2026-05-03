import type { ToolSchema } from '../core/types.js';

export const todoWriteSchema: ToolSchema = {
  name: 'todo_write',
  description: 'Manage a todo list for multi-step tasks. Use this to track progress, maintain focus, and avoid skipping or repeating steps. Only one item can be in_progress at a time.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'complete', 'list'],
        description: 'Action to perform: add (create new todo), update (change status/description), complete (mark as done), list (show all todos)'
      },
      id: {
        type: 'string',
        description: 'Todo item ID (required for update/complete actions)'
      },
      description: {
        type: 'string',
        description: 'Todo item description (required for add action, optional for update)'
      },
      status: {
        type: 'string',
        enum: ['pending', 'in_progress', 'completed'],
        description: 'New status for the todo item (used with update action)'
      }
    },
    required: ['action'],
    additionalProperties: false
  }
};
