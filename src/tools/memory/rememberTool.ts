import { MemoryManager } from '../../agent/memory/memoryManager.js';
import type { MemoryScope } from '../../agent/memory/types.js';
import type { ToolDefinition } from '../core/types.js';
import { rememberSchema } from './schema.js';

interface RememberInput extends Record<string, unknown> {
  scope: MemoryScope;
  content: string;
}

const VALID_SCOPES = new Set<MemoryScope>(['project_fact', 'user_preference', 'workflow_note']);

export function createRememberTool({ memory }: { memory: MemoryManager }): ToolDefinition<RememberInput> {
  return {
    name: 'remember',
    schema: rememberSchema,
    async execute(input) {
      if (!VALID_SCOPES.has(input.scope)) {
        return `Error: unknown memory scope ${String(input.scope)}`;
      }
      if (typeof input.content !== 'string') {
        return 'Error: content must be a string';
      }

      return memory.remember(input.scope, input.content);
    }
  };
}
