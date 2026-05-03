import type { ToolCall } from '../../../types.js';

interface TodoSnapshotItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export class TodoTracker {
  private readonly descriptions = new Map<string, string>();
  private readonly statuses = new Map<string, TodoSnapshotItem['status']>();

  summarizeStart(toolCall: ToolCall): string | null {
    if (toolCall.name !== 'todo_write') {
      return null;
    }

    const action = stringValue(toolCall.input.action);
    const description = stringValue(toolCall.input.description);
    const status = stringValue(toolCall.input.status);
    const id = stringValue(toolCall.input.id);

    if (action === 'add') {
      return `todo add       ${description}`;
    }

    if (action === 'update' && status === 'in_progress') {
      return `todo focus     ${this.labelFor(id)}`;
    }

    if (action === 'update' && status) {
      return `todo update    ${this.labelFor(id)} -> ${status}`;
    }

    if (action === 'complete') {
      return `todo done      ${this.labelFor(id)}`;
    }

    if (action === 'list') {
      return 'todo list';
    }

    return `todo ${action || 'unknown'}`;
  }

  observeResult(toolCall: ToolCall, output: string): void {
    if (toolCall.name !== 'todo_write') {
      return;
    }

    this.observeMutationResult(output);
    this.observeListResult(output);
  }

  panelFromOutput(output: string): string | null {
    const items = parseTodoList(output);
    if (items.length === 0) {
      return null;
    }

    for (const item of items) {
      this.descriptions.set(item.id, item.description);
      this.statuses.set(item.id, item.status);
    }

    return [
      'Todo',
      ...items.map((item) => `  ${iconForStatus(item.status)} ${item.description}`),
      ''
    ].join('\n');
  }

  private observeMutationResult(output: string): void {
    const match = output.match(/^(?:Added|Updated|Completed) todo: \[([^\]]+)\] (.+?)(?: \(([^)]+)\))?$/);
    if (!match) {
      return;
    }

    const [, id, description, status] = match;
    this.descriptions.set(id, description);

    if (output.startsWith('Added')) {
      this.statuses.set(id, 'pending');
    } else if (output.startsWith('Completed')) {
      this.statuses.set(id, 'completed');
    } else if (status === 'pending' || status === 'in_progress' || status === 'completed') {
      this.statuses.set(id, status);
    }
  }

  private observeListResult(output: string): void {
    for (const item of parseTodoList(output)) {
      this.descriptions.set(item.id, item.description);
      this.statuses.set(item.id, item.status);
    }
  }

  private labelFor(id: string): string {
    if (!id) {
      return '(missing id)';
    }

    return this.descriptions.get(id) ?? id;
  }
}

function parseTodoList(output: string): TodoSnapshotItem[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .map(parseTodoLine)
    .filter((item): item is TodoSnapshotItem => Boolean(item));
}

function parseTodoLine(line: string): TodoSnapshotItem | null {
  const match = line.match(/^([✓→○]) \[([^\]]+)\] (.*?)(?: \[FOCUS\])?$/);
  if (!match) {
    return null;
  }

  const [, icon, id, description] = match;
  return {
    id,
    description,
    status: statusForIcon(icon)
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function statusForIcon(icon: string): TodoSnapshotItem['status'] {
  if (icon === '✓') {
    return 'completed';
  }

  if (icon === '→') {
    return 'in_progress';
  }

  return 'pending';
}

function iconForStatus(status: TodoSnapshotItem['status']): string {
  if (status === 'completed') {
    return '✓';
  }

  if (status === 'in_progress') {
    return '→';
  }

  return '○';
}
