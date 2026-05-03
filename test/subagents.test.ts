import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadSubagentRegistry, parseSubagentMarkdown } from '../src/agent/subagents/loadSubagents.js';

test('parses a markdown subagent manifest', () => {
  const config = parseSubagentMarkdown(
    [
      '---',
      'name: researcher',
      'description: Read-only exploration',
      'tools:',
      '  - read_file',
      '  - bash',
      'maxTurns: 4',
      '---',
      '',
      'You are a focused researcher.'
    ].join('\n')
  );

  assert.deepEqual(config, {
    name: 'researcher',
    description: 'Read-only exploration',
    tools: ['read_file', 'bash'],
    maxTurns: 4,
    prompt: 'You are a focused researcher.'
  });
});

test('loads multiple subagent markdown files from the workspace', async () => {
  const workspace = await createTempWorkspace();
  try {
    await mkdir(path.join(workspace, 'subagents'), { recursive: true });
    await writeFile(
      path.join(workspace, 'subagents', 'general.md'),
      [
        '---',
        'name: general',
        'description: General purpose child agent',
        'tools:',
        '  - read_file',
        'maxTurns: 8',
        '---',
        '',
        'General prompt.'
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'subagents', 'researcher.md'),
      [
        '---',
        'name: researcher',
        'description: Read-only exploration',
        'tools:',
        '  - read_file',
        '  - bash',
        'maxTurns: 4',
        '---',
        '',
        'Research prompt.'
      ].join('\n'),
      'utf8'
    );

    const registry = await loadSubagentRegistry({ workspaceRoot: workspace });

    assert.deepEqual(registry.availableNames(), ['general', 'researcher']);
    assert.equal(registry.get('researcher')?.prompt, 'Research prompt.');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('uses a built-in general subagent when no subagent directory exists', async () => {
  const workspace = await createTempWorkspace();
  try {
    const registry = await loadSubagentRegistry({ workspaceRoot: workspace });

    assert.deepEqual(registry.availableNames(), ['general']);
    assert.match(registry.getDefault().prompt, /general purpose child agent/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

async function createTempWorkspace(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'mini-agent-subagents-'));
}
