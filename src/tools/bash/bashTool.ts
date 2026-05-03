import type { ToolDefinition } from '../core/types.js';
import { bashSchema } from './schema.js';
import { runBash } from './utils/command.js';

export function createBashTool({ workspaceRoot }: { workspaceRoot: string }): ToolDefinition {
  return {
    name: 'bash',
    schema: bashSchema,
    async execute(input, context) {
      if (typeof input.command !== 'string' || input.command.trim() === '') {
        throw new Error('command must be a non-empty string');
      }

      return runBash(input.command, workspaceRoot, context?.signal);
    }
  };
}
