export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  id: string;
  description: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlanState {
  items: TodoItem[];
  currentFocus?: string; // id of the in_progress item
}
