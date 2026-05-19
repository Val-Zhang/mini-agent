import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import { createAgent } from '../src/agent/createAgent.js';
import { readAuditRecords } from '../src/agent/hooks/auditHook.js';
import type { ChatMessage, ModelChatOptions, ModelResponse } from '../src/types.js';

test('createAgent installs the default audit hook', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'mini-agent-create-agent-'));
  try {
    const model = new FakeModel([
      {
        content: 'Done.',
        toolCalls: []
      }
    ]);
    const agent = await createAgent({ model, workspaceRoot: workspace });

    await agent.send('hello');

    const records = await readAuditRecords(workspace);
    assert.deepEqual(
      records.map((record) => record.type),
      ['session_start', 'session_end']
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

class FakeModel {
  constructor(private readonly responses: Array<Partial<ModelResponse>>) {}

  async chat(_messages: ChatMessage[], _options?: ModelChatOptions): Promise<ModelResponse> {
    const response = this.responses.shift();
    if (!response) {
      throw new Error('FakeModel received an unexpected call');
    }
    return {
      stopReason: null,
      toolCalls: [],
      content: '',
      raw: {},
      ...response
    };
  }
}
