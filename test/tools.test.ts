import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SubagentRegistry } from '../src/agent/subagents/SubagentRegistry.js';
import { createBashTool } from '../src/tools/bash/bashTool.js';
import { createDefaultTools } from '../src/tools/defaultTools.js';
import { createFilesystemTools } from '../src/tools/filesystem/filesystemTools.js';
import { createPathSandbox } from '../src/tools/core/pathSandbox.js';
import { ToolRegistry } from '../src/tools/core/ToolRegistry.js';
import type { ChatMessage, ModelChatOptions, ModelResponse } from '../src/types.js';

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

    const writeFileTool = tools.get('write_file');
    assert.ok(writeFileTool);
    const writeResult = await writeFileTool.execute({
      path: 'notes/greet.txt',
      content: 'hello world'
    });
    assert.match(writeResult, /Wrote 11 characters/);

    const readFileTool = tools.get('read_file');
    assert.ok(readFileTool);
    const readResult = await readFileTool.execute({
      path: 'notes/greet.txt'
    });
    assert.equal(readResult, 'hello world');

    const editFileTool = tools.get('edit_file');
    assert.ok(editFileTool);
    const editResult = await editFileTool.execute({
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
    const readFileTool = tools.get('read_file');
    assert.ok(readFileTool);

    await assert.rejects(
      Promise.resolve(readFileTool.execute({ path: '../secret.txt' })),
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

    assert.deepEqual(names, ['bash', 'edit_file', 'read_file', 'todo_write', 'write_file']);
    assert.ok(tools.every((tool) => tool.schema?.parameters?.type === 'object'));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('default tools include task when subagents are enabled', async () => {
  const workspace = await createTempWorkspace();
  try {
    const tools = createDefaultTools({
      workspaceRoot: workspace,
      subagents: {
        model: new FakeModel(),
        registry: new SubagentRegistry([
          {
            name: 'general',
            description: 'General child agent',
            tools: ['read_file'],
            maxTurns: 8,
            prompt: 'general prompt'
          }
        ])
      }
    });
    const names = tools.map((tool) => tool.name).sort();

    assert.deepEqual(names, ['bash', 'edit_file', 'read_file', 'task', 'todo_write', 'write_file']);
    assert.ok(tools.every((tool) => tool.schema?.parameters?.type === 'object'));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('default tools fail fast when subagent tool allowlist references unknown tools', async () => {
  const workspace = await createTempWorkspace();
  try {
    assert.throws(
      () =>
        createDefaultTools({
          workspaceRoot: workspace,
          subagents: {
            model: new FakeModel(),
            registry: new SubagentRegistry([
              {
                name: 'general',
                description: 'General child agent',
                tools: ['read_file', 'nonexistent_tool'],
                maxTurns: 8,
                prompt: 'general prompt'
              }
            ])
          }
        }),
      /Unknown subagent tools: nonexistent_tool/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

async function createTempWorkspace(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'mini-agent-tools-'));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class FakeModel {
  async chat(_messages: ChatMessage[], _options?: ModelChatOptions): Promise<ModelResponse> {
    return {
      content: 'ok',
      toolCalls: [],
      stopReason: 'stop',
      raw: {}
    };
  }
}
