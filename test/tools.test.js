import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createBashTool } from '../src/tools/bashTool.js';
import { createDefaultTools } from '../src/tools/defaultTools.js';
import { createFilesystemTools } from '../src/tools/filesystemTools.js';
import { createPathSandbox } from '../src/tools/pathSandbox.js';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';

test('path sandbox rejects paths outside the workspace', async () => {
  const workspace = await createTempWorkspace();
  try {
    const sandbox = createPathSandbox(workspace);

    assert.equal(sandbox.resolvePath('inside.txt'), path.join(workspace, 'inside.txt'));
    assert.throws(() => sandbox.resolvePath('../outside.txt'), /Path escapes workspace/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('filesystem tools read, write, and edit files inside the workspace', async () => {
  const workspace = await createTempWorkspace();
  try {
    const sandbox = createPathSandbox(workspace);
    const tools = new ToolRegistry(createFilesystemTools({ sandbox }));

    const writeResult = await tools.get('write_file').execute({
      path: 'notes/greet.txt',
      content: 'hello world'
    });
    assert.match(writeResult, /Wrote 11 characters/);

    const readResult = await tools.get('read_file').execute({
      path: 'notes/greet.txt'
    });
    assert.equal(readResult, 'hello world');

    const editResult = await tools.get('edit_file').execute({
      path: 'notes/greet.txt',
      old_text: 'world',
      new_text: 'agent'
    });
    assert.equal(editResult, 'Edited notes/greet.txt');

    const finalText = await readFile(path.join(workspace, 'notes/greet.txt'), 'utf8');
    assert.equal(finalText, 'hello agent');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('filesystem tools reject workspace escapes', async () => {
  const workspace = await createTempWorkspace();
  try {
    const sandbox = createPathSandbox(workspace);
    const tools = new ToolRegistry(createFilesystemTools({ sandbox }));

    await assert.rejects(
      tools.get('read_file').execute({ path: '../secret.txt' }),
      /Path escapes workspace/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('bash tool runs commands in the workspace', async () => {
  const workspace = await createTempWorkspace();
  try {
    await writeFile(path.join(workspace, 'hello.txt'), 'hello', 'utf8');
    const tool = createBashTool({ workspaceRoot: workspace });

    const result = await tool.execute({ command: 'pwd && ls hello.txt' });

    assert.match(result, /exit_code: 0/);
    assert.match(result, new RegExp(escapeRegExp(workspace)));
    assert.match(result, /hello\.txt/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('default tools expose schemas for model tool calling', async () => {
  const workspace = await createTempWorkspace();
  try {
    const tools = createDefaultTools({ workspaceRoot: workspace });
    const names = tools.map((tool) => tool.name).sort();

    assert.deepEqual(names, ['bash', 'edit_file', 'read_file', 'write_file']);
    assert.ok(tools.every((tool) => tool.schema?.parameters?.type === 'object'));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

async function createTempWorkspace() {
  return mkdtemp(path.join(os.tmpdir(), 'mini-agent-tools-'));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
