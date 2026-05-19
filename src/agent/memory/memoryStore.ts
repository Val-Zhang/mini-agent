import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { MemoryEntry, MemoryScope, MemorySnapshot } from './types.js';

export function memoryDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'memories');
}

export function memoryFilePath(workspaceRoot: string, scope: MemoryScope): string {
  switch (scope) {
    case 'project_fact':
      return path.join(memoryDirectory(workspaceRoot), 'project', 'facts.md');
    case 'user_preference':
      return path.join(memoryDirectory(workspaceRoot), 'user', 'preferences.md');
    case 'workflow_note':
      return path.join(memoryDirectory(workspaceRoot), 'project', 'workflow.md');
  }
}

export class MemoryStore {
  constructor(private readonly workspaceRoot: string) {}

  async append(entry: Omit<MemoryEntry, 'createdAt'>): Promise<MemoryEntry> {
    const stored: MemoryEntry = { ...entry, createdAt: new Date().toISOString() };
    const target = memoryFilePath(this.workspaceRoot, stored.scope);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${formatMemoryEntry(stored)}\n`, { flag: 'a' });
    return stored;
  }

  async snapshot(): Promise<MemorySnapshot> {
    const [projectFacts, userPreferences, workflowNotes] = await Promise.all([
      readMemoryLines(memoryFilePath(this.workspaceRoot, 'project_fact')),
      readMemoryLines(memoryFilePath(this.workspaceRoot, 'user_preference')),
      readMemoryLines(memoryFilePath(this.workspaceRoot, 'workflow_note'))
    ]);

    return { projectFacts, userPreferences, workflowNotes };
  }
}

export async function readMemoryLines(filePath: string): Promise<string[]> {
  try {
    const content = await readFile(filePath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => stripMemoryMetadata(line.slice(2).trim()));
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function formatMemoryEntry(entry: MemoryEntry): string {
  return `- ${entry.content.trim()} _(saved ${entry.createdAt})_`;
}

function stripMemoryMetadata(value: string): string {
  return value.replace(/\s+_\(saved .+\)_$/u, '').trim();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
