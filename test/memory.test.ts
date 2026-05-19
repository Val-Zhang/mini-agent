import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

import { MemoryManager, formatMemorySummary } from '../src/agent/memory/memoryManager.js';
import { MemoryStore, memoryFilePath } from '../src/agent/memory/memoryStore.js';
import { createRememberTool } from '../src/tools/memory/rememberTool.js';

test('memory store writes durable markdown memories by scope', async () => {
  const workspace = await createWorkspace();
  try {
    const store = new MemoryStore(workspace);
    await store.append({ scope: 'project_fact', content: 'Project uses NodeNext modules.' });
    await store.append({ scope: 'user_preference', content: 'User prefers concise summaries.' });

    const factFile = await readFile(memoryFilePath(workspace, 'project_fact'), 'utf8');
    const preferenceFile = await readFile(memoryFilePath(workspace, 'user_preference'), 'utf8');
    const snapshot = await store.snapshot();

    assert.match(factFile, /Project uses NodeNext modules/);
    assert.match(preferenceFile, /User prefers concise summaries/);
    assert.deepEqual(snapshot.projectFacts, ['Project uses NodeNext modules.']);
    assert.equal(snapshot.userPreferences.length, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('memory manager formats a concise summary and avoids duplicates', async () => {
  const workspace = await createWorkspace();
  try {
    const manager = new MemoryManager(workspace);

    assert.match(await manager.remember('project_fact', 'Project uses NodeNext modules.'), /Remembered project_fact/);
    assert.match(await manager.remember('project_fact', ' Project uses   NodeNext modules. '), /already exists/);
    assert.match(await manager.remember('workflow_note', 'Run tests before committing.'), /Remembered workflow_note/);

    const summary = await manager.buildSummary();
    assert.match(summary, /## Project Facts/);
    assert.match(summary, /Project uses NodeNext modules/);
    assert.match(summary, /## Workflow Notes/);
    assert.match(summary, /Run tests before committing/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('remember tool persists explicit memories', async () => {
  const workspace = await createWorkspace();
  try {
    const memory = new MemoryManager(workspace);
    const tool = createRememberTool({ memory });

    const result = await tool.execute({ scope: 'user_preference', content: 'User likes examples.' });
    const summary = await memory.buildSummary();

    assert.match(result, /Remembered user_preference/);
    assert.match(summary, /User likes examples/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('formatMemorySummary returns empty text when no memories exist', () => {
  assert.equal(formatMemorySummary({ projectFacts: [], userPreferences: [], workflowNotes: [] }), '');
});

async function createWorkspace(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'mini-agent-memory-'));
}
