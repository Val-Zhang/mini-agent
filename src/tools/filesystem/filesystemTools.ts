import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { PathSandbox } from '../core/pathSandbox.js';
import type { ToolDefinition } from '../core/types.js';
import { editFileSchema, readFileSchema, writeFileSchema } from './schemas.js';
import { requireNonEmptyString, requireString } from './utils/input.js';
import { limitLines } from './utils/text.js';

export function createFilesystemTools({ sandbox }: { sandbox: PathSandbox }): ToolDefinition[] {
  return [
    createReadFileTool(sandbox),
    createWriteFileTool(sandbox),
    createEditFileTool(sandbox)
  ];
}

function createReadFileTool(sandbox: PathSandbox): ToolDefinition {
  return {
    name: 'read_file',
    schema: readFileSchema,
    async execute(input) {
      const filePath = sandbox.resolvePath(requireString(input.path, 'path'));
      const text = await readFile(filePath, 'utf8');

      return limitLines(text, input.limit);
    }
  };
}

function createWriteFileTool(sandbox: PathSandbox): ToolDefinition {
  return {
    name: 'write_file',
    schema: writeFileSchema,
    async execute(input) {
      const requestedPath = requireString(input.path, 'path');
      const content = requireString(input.content, 'content');
      const filePath = sandbox.resolvePath(requestedPath);

      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf8');

      return `Wrote ${content.length} characters to ${requestedPath}`;
    }
  };
}

function createEditFileTool(sandbox: PathSandbox): ToolDefinition {
  return {
    name: 'edit_file',
    schema: editFileSchema,
    async execute(input) {
      const requestedPath = requireString(input.path, 'path');
      const oldText = requireNonEmptyString(input.old_text, 'old_text');
      const newText = requireString(input.new_text, 'new_text');
      const filePath = sandbox.resolvePath(requestedPath);
      const text = await readFile(filePath, 'utf8');

      if (!text.includes(oldText)) {
        throw new Error(`old_text was not found in ${requestedPath}`);
      }

      await writeFile(filePath, text.replace(oldText, newText), 'utf8');

      return `Edited ${requestedPath}`;
    }
  };
}
