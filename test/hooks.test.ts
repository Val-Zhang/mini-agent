import test from 'node:test';
import assert from 'node:assert/strict';

import { HookRegistry } from '../src/agent/hooks/HookRegistry.js';
import { createAuditHook, readAuditRecords } from '../src/agent/hooks/auditHook.js';
import { createToolCallExecutionResult } from '../src/agent/run/toolExecution.js';

test('hook registry calls lifecycle hooks in order', async () => {
  const calls: string[] = [];
  const registry = new HookRegistry([
    {
      name: 'recorder',
      onSessionStart() {
        calls.push('session_start');
      },
      onPreToolUse() {
        calls.push('pre_tool');
      },
      onPostToolUse() {
        calls.push('post_tool');
      },
      onSessionEnd() {
        calls.push('session_end');
      }
    }
  ]);

  await registry.sessionStart({ input: 'hello', mode: 'execute' });
  await registry.preToolUse({
    toolCall: { id: 'call_echo', name: 'echo', input: {} },
    mode: 'execute',
    permission: { decision: 'allow', reason: 'ok' }
  });
  await registry.postToolUse({
    toolCall: { id: 'call_echo', name: 'echo', input: {} },
    mode: 'execute',
    permission: { decision: 'allow', reason: 'ok' },
    result: createToolCallExecutionResult({
      toolCall: { id: 'call_echo', name: 'echo', input: {} },
      content: 'done',
      isError: false,
      durationMs: 3
    })
  });
  await registry.sessionEnd({ input: 'hello', mode: 'execute', status: 'completed', message: 'done' });

  assert.deepEqual(calls, ['session_start', 'pre_tool', 'post_tool', 'session_end']);
});

test('pre tool hook can block execution', async () => {
  const registry = new HookRegistry([
    {
      name: 'blocker',
      onPreToolUse() {
        return { action: 'block', reason: 'blocked by policy' };
      }
    }
  ]);

  const result = await registry.preToolUse({
    toolCall: { id: 'call_write', name: 'write_file', input: {} },
    mode: 'execute',
    permission: { decision: 'allow', reason: 'ok' }
  });

  assert.deepEqual(result, { hookName: 'blocker', reason: 'blocked by policy' });
});

test('audit hook persists session and tool records', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-agent-audit-hook-'));

  try {
    const hook = createAuditHook(workspace);
    const toolCall = { id: 'call_echo', name: 'echo', input: { text: 'hello' } };
    await hook.onSessionStart?.({ input: 'hello', mode: 'execute' });
    await hook.onPostToolUse?.({
      toolCall,
      mode: 'execute',
      permission: { decision: 'allow', reason: 'echo is safe' },
      result: createToolCallExecutionResult({ toolCall, content: 'world', isError: false, durationMs: 4 })
    });
    await hook.onSessionEnd?.({ input: 'hello', mode: 'execute', status: 'completed', message: 'world' });

    const records = await readAuditRecords(workspace);
    assert.deepEqual(
      records.map((record) => record.type),
      ['session_start', 'tool_use', 'session_end']
    );
    assert.equal(records[1].type, 'tool_use');
    if (records[1].type === 'tool_use') {
      assert.equal(records[1].toolName, 'echo');
      assert.equal(records[1].permissionDecision, 'allow');
      assert.equal(records[1].isError, false);
    }
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
