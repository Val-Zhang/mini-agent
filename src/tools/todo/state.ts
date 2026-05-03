import type { PlanState, TodoItem, TodoStatus } from './types.js';

export class TodoState {
  private state: PlanState;

  constructor() {
    this.state = { items: [] };
  }

  add(description: string): TodoItem {
    const id = `todo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const item: TodoItem = {
      id,
      description,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
    this.state.items.push(item);
    return item;
  }

  update(id: string, updates: { description?: string; status?: TodoStatus }): TodoItem {
    const item = this.state.items.find(t => t.id === id);
    if (!item) {
      throw new Error(`Todo item not found: ${id}`);
    }

    // Enforce single in_progress constraint
    if (updates.status === 'in_progress') {
      const currentInProgress = this.state.items.find(t => t.status === 'in_progress' && t.id !== id);
      if (currentInProgress) {
        throw new Error(`Cannot set ${id} to in_progress: ${currentInProgress.id} is already in progress. Complete or update it first.`);
      }
      this.state.currentFocus = id;
    }

    if (updates.description !== undefined) {
      item.description = updates.description;
    }
    if (updates.status !== undefined) {
      item.status = updates.status;
      if (updates.status !== 'in_progress' && this.state.currentFocus === id) {
        this.state.currentFocus = undefined;
      }
    }
    item.updatedAt = new Date().toISOString();
    return item;
  }

  complete(id: string): TodoItem {
    return this.update(id, { status: 'completed' });
  }

  list(): PlanState {
    return { ...this.state };
  }

  formatList(): string {
    if (this.state.items.length === 0) {
      return 'No todos yet.';
    }

    const lines: string[] = ['Current todos:'];
    for (const item of this.state.items) {
      const statusIcon = item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '→' : '○';
      const focus = item.id === this.state.currentFocus ? ' [FOCUS]' : '';
      lines.push(`  ${statusIcon} [${item.id}] ${item.description}${focus}`);
    }

    const pending = this.state.items.filter(t => t.status === 'pending').length;
    const inProgress = this.state.items.filter(t => t.status === 'in_progress').length;
    const completed = this.state.items.filter(t => t.status === 'completed').length;
    lines.push(`\nSummary: ${pending} pending, ${inProgress} in progress, ${completed} completed`);

    return lines.join('\n');
  }
}
