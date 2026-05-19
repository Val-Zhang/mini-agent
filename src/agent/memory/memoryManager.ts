import { MemoryStore } from './memoryStore.js';
import type { MemoryScope, MemorySnapshot } from './types.js';

const MAX_ITEMS_PER_SECTION = 8;

export class MemoryManager {
  private readonly store: MemoryStore;

  constructor(workspaceRoot: string) {
    this.store = new MemoryStore(workspaceRoot);
  }

  async remember(scope: MemoryScope, content: string): Promise<string> {
    const normalized = normalizeMemoryContent(content);
    if (!normalized) {
      return 'Error: memory content must not be empty.';
    }

    const snapshot = await this.store.snapshot();
    if (hasDuplicate(snapshot, normalized)) {
      return `Memory already exists: ${normalized}`;
    }

    const entry = await this.store.append({ scope, content: normalized });
    return `Remembered ${scope}: ${entry.content}`;
  }

  async buildSummary(): Promise<string> {
    return formatMemorySummary(await this.store.snapshot());
  }
}

export function formatMemorySummary(snapshot: MemorySnapshot): string {
  const sections = [
    formatSection('Project Facts', snapshot.projectFacts),
    formatSection('User Preferences', snapshot.userPreferences),
    formatSection('Workflow Notes', snapshot.workflowNotes)
  ].filter((section) => section !== '');

  return sections.join('\n\n');
}

function formatSection(title: string, values: string[]): string {
  const unique = uniqueValues(values).slice(-MAX_ITEMS_PER_SECTION);
  if (unique.length === 0) {
    return '';
  }

  return [`## ${title}`, ...unique.map((value) => `- ${value}`)].join('\n');
}

function hasDuplicate(snapshot: MemorySnapshot, content: string): boolean {
  return [...snapshot.projectFacts, ...snapshot.userPreferences, ...snapshot.workflowNotes].some(
    (item) => normalizeMemoryContent(item) === content
  );
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeMemoryContent(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeMemoryContent(content: string): string {
  return content.trim().replace(/\s+/gu, ' ');
}
