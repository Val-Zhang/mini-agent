import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { SubagentRegistry } from '../src/agent/subagents/SubagentRegistry.js';
import { createBashTool } from '../src/tools/bash/bashTool.js';
import { createDiscoveryTools } from '../src/tools/discovery/discoveryTools.js';
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

test('bash tool can be cancelled via abort signal', async () => {
  const workspace = await createTempWorkspace();
  const controller = new AbortController();
  const tool = createBashTool({ workspaceRoot: workspace });
  const timer = setTimeout(() => controller.abort('Run cancelled by user'), 50);

  try {
    await assert.rejects(
      () =>
        Promise.resolve(
          tool.execute(
            { command: 'sleep 5' },
            {
              emit: () => {},
              signal: controller.signal
            }
          )
        ),
      /Run cancelled by user/
    );
  } finally {
    clearTimeout(timer);
    await rm(workspace, { recursive: true, force: true });
  }
});

test('list_dir tool lists entries with depth control', async () => {
  const workspace = await createTempWorkspace();
  try {
    await writeFile(path.join(workspace, 'top.txt'), 'top', 'utf8');
    await mkdir(path.join(workspace, 'src'), { recursive: true });
    await writeFile(path.join(workspace, 'src', 'index.ts'), 'export {};', 'utf8');

    const sandbox = createPathSandbox(workspace);
    const tools = new ToolRegistry(createDiscoveryTools({ sandbox }));
    const listDirTool = tools.get('list_dir');
    assert.ok(listDirTool);

    const result = await listDirTool.execute({ path: '.', depth: 2 });
    assert.match(result, /Directory: \./);
    assert.match(result, /\[file\] top\.txt/);
    assert.match(result, /\[dir\] src/);
    assert.match(result, /\[file\] src\/index\.ts/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('glob tool matches paths under workspace', async () => {
  const workspace = await createTempWorkspace();
  try {
    await mkdir(path.join(workspace, 'src'), { recursive: true });
    await writeFile(path.join(workspace, 'src', 'index.ts'), 'export const a = 1;', 'utf8');
    await writeFile(path.join(workspace, 'src', 'helper.js'), 'module.exports = {};', 'utf8');

    const sandbox = createPathSandbox(workspace);
    const tools = new ToolRegistry(createDiscoveryTools({ sandbox }));
    const globTool = tools.get('glob');
    assert.ok(globTool);

    const result = await globTool.execute({ pattern: 'src/**/*.ts' });
    assert.match(result, /Pattern: src\/\*\*\/\*\.ts/);
    assert.match(result, /- src\/index\.ts/);
    assert.doesNotMatch(result, /helper\.js/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('grep tool returns structured matches', async () => {
  const workspace = await createTempWorkspace();
  try {
    await mkdir(path.join(workspace, 'src'), { recursive: true });
    await writeFile(path.join(workspace, 'src', 'alpha.ts'), 'const token = "abc123";\n', 'utf8');
    await writeFile(path.join(workspace, 'src', 'beta.ts'), 'const token = "xyz";\n', 'utf8');

    const sandbox = createPathSandbox(workspace);
    const tools = new ToolRegistry(createDiscoveryTools({ sandbox }));
    const grepTool = tools.get('grep');
    assert.ok(grepTool);

    const result = await grepTool.execute({ pattern: 'abc123', path: 'src' });
    assert.match(result, /Pattern: abc123/);
    assert.match(result, /Search path: src/);
    assert.match(result, /- src\/alpha\.ts:\d+:\d+ \|/);
    assert.doesNotMatch(result, /beta\.ts/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('web_fetch tool extracts content and source metadata', async () => {
  const server = createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end('missing');
      return;
    }

    if (req.url === '/post') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(`
        <html>
          <head><title>Test Article</title></head>
          <body>
            <h1>Hello Agent</h1>
            <p>This is a test page for web_fetch.</p>
          </body>
        </html>
      `);
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  assert.ok(port);

  try {
    const workspace = await createTempWorkspace();
    const sandbox = createPathSandbox(workspace);
    const tools = new ToolRegistry(createDiscoveryTools({ sandbox }));
    const webFetchTool = tools.get('web_fetch');
    assert.ok(webFetchTool);

    const result = await webFetchTool.execute({
      url: `http://127.0.0.1:${port}/post`,
      max_chars: 3000
    });

    assert.match(result, /URL: http:\/\/127\.0\.0\.1:\d+\/post/);
    assert.match(result, /Status: 200/);
    assert.match(result, /Content-Type: text\/html/);
    assert.match(result, /Title: Test Article/);
    assert.match(result, /Hello Agent/);
    assert.match(result, /test page for web_fetch/);
    await rm(workspace, { recursive: true, force: true });
  } finally {
    server.close();
  }
});

test('default tools expose schemas for model tool calling', async () => {
  const workspace = await createTempWorkspace();
  try {
    const tools = createDefaultTools({ workspaceRoot: workspace });
    const names = tools.map((tool) => tool.name).sort();

    assert.deepEqual(names, ['bash', 'edit_file', 'glob', 'grep', 'list_dir', 'read_file', 'todo_write', 'web_fetch', 'write_file']);
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

    assert.deepEqual(names, ['bash', 'edit_file', 'glob', 'grep', 'list_dir', 'read_file', 'task', 'todo_write', 'web_fetch', 'write_file']);
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
