import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_READ_CHARS = 50_000;

export function createFilesystemTools({ sandbox }) {
  return [
    {
      name: 'read_file',
      schema: {
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
      },
      async execute(input) {
        const filePath = sandbox.resolvePath(input.path);
        const text = await readFile(filePath, 'utf8');
        const lines = text.split(/\r?\n/);
        const limited = Number.isInteger(input.limit) && input.limit > 0 ? lines.slice(0, input.limit) : lines;

        return truncate(limited.join('\n'));
      }
    },
    {
      name: 'write_file',
      schema: {
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
      },
      async execute(input) {
        if (typeof input.content !== 'string') {
          throw new Error('content must be a string');
        }

        const filePath = sandbox.resolvePath(input.path);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, input.content, 'utf8');

        return `Wrote ${input.content.length} characters to ${input.path}`;
      }
    },
    {
      name: 'edit_file',
      schema: {
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
      },
      async execute(input) {
        if (typeof input.old_text !== 'string' || typeof input.new_text !== 'string') {
          throw new Error('old_text and new_text must be strings');
        }

        if (input.old_text.length === 0) {
          throw new Error('old_text must not be empty');
        }

        const filePath = sandbox.resolvePath(input.path);
        const text = await readFile(filePath, 'utf8');

        if (!text.includes(input.old_text)) {
          throw new Error(`old_text was not found in ${input.path}`);
        }

        const next = text.replace(input.old_text, input.new_text);
        await writeFile(filePath, next, 'utf8');

        return `Edited ${input.path}`;
      }
    }
  ];
}

function truncate(value) {
  if (value.length <= MAX_READ_CHARS) {
    return value;
  }

  return `${value.slice(0, MAX_READ_CHARS)}\n[truncated at ${MAX_READ_CHARS} characters]`;
}
