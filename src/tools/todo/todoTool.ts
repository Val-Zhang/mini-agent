import type { ToolDefinition } from '../core/types.js';
import { todoWriteSchema } from './schema.js';
import { TodoState } from './state.js';
import type { TodoStatus } from './types.js';

interface TodoWriteInput extends Record<string, unknown> {
  action: 'add' | 'update' | 'complete' | 'list';
  id?: string;
  description?: string;
  status?: TodoStatus;
}

export function createTodoTool({ workspaceRoot }: { workspaceRoot: string }): ToolDefinition<TodoWriteInput> {
  const state = new TodoState(workspaceRoot);
  let queue = Promise.resolve();

  return {
    name: 'todo_write',
    schema: todoWriteSchema,
    async execute(input: TodoWriteInput): Promise<string> {
      const result = queue.then(() => executeTodoAction(state, input));
      queue = result.then(
        () => undefined,
        () => undefined
      );

      return result;
    }
  };
}

async function executeTodoAction(state: TodoState, input: TodoWriteInput): Promise<string> {
  try {
    await state.load();

    switch (input.action) {
      case 'add': {
        if (!input.description) {
          return 'Error: description is required for add action';
        }
        const item = state.add(input.description);
        await state.save();
        return `Added todo: [${item.id}] ${item.description}`;
      }

      case 'update': {
        if (!input.id) {
          return 'Error: id is required for update action';
        }
        const updates: { description?: string; status?: TodoStatus } = {};
        if (input.description !== undefined) {
          updates.description = input.description;
        }
        if (input.status !== undefined) {
          updates.status = input.status;
        }
        const item = state.update(input.id, updates);
        await state.save();
        return `Updated todo: [${item.id}] ${item.description} (${item.status})`;
      }

      case 'complete': {
        if (!input.id) {
          return 'Error: id is required for complete action';
        }
        const item = state.complete(input.id);
        await state.save();
        return `Completed todo: [${item.id}] ${item.description}`;
      }

      case 'list': {
        return state.formatList();
      }

      default:
        return `Error: unknown action ${input.action}`;
    }
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return 'Error: unknown error occurred';
  }
}
