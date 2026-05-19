export type MemoryScope = 'project_fact' | 'user_preference' | 'workflow_note';

export interface MemoryEntry {
  scope: MemoryScope;
  content: string;
  createdAt: string;
}

export interface MemorySnapshot {
  projectFacts: string[];
  userPreferences: string[];
  workflowNotes: string[];
}
