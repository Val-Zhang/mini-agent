import type { ToolSchema } from '../core/types.js';

export const readFileSchema: ToolSchema = {
  name: 'read_file',
  description: 'Read a UTF-8 text file inside the current workspace.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Workspace-relative path to read.'
      },
      limit: {
        type: 'number',
        description: 'Optional maximum number of lines to return.'
      }
    },
    required: ['path'],
    additionalProperties: false
  }
};

export const writeFileSchema: ToolSchema = {
  name: 'write_file',
  description: 'Write UTF-8 text to a file inside the current workspace, creating parent directories when needed.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Workspace-relative path to write.'
      },
      content: {
        type: 'string',
        description: 'File content to write.'
      }
    },
    required: ['path', 'content'],
    additionalProperties: false
  }
};

export const editFileSchema: ToolSchema = {
  name: 'edit_file',
  description: 'Replace an exact text segment in a UTF-8 file inside the current workspace.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Workspace-relative path to edit.'
      },
      old_text: {
        type: 'string',
        description: 'Exact text to replace.'
      },
      new_text: {
        type: 'string',
        description: 'Replacement text.'
      }
    },
    required: ['path', 'old_text', 'new_text'],
    additionalProperties: false
  }
};
