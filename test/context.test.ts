import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextManager } from '../src/agent/context/contextManager.js';
import { loadContextConfig } from '../src/agent/context/config.js';
import type { ChatMessage } from '../src/types.js';

test('loads context config from environment with safe fallbacks', () => {
  const config = loadContextConfig({
    AGENT_CONTEXT_WINDOW: '1000',
    AGENT_RESERVED_OUTPUT_TOKENS: '100',
    AGENT_WARN_THRESHOLD: '0.5',
    AGENT_COMPACT_THRESHOLD: '0.7',
    AGENT_CRITICAL_THRESHOLD: '0.9',
    AGENT_RECENT_MESSAGE_MIN_TOKENS: '200',
    AGENT_SUMMARY_MAX_TOKENS: '300'
  });

  assert.equal(config.contextWindow, 1000);
  assert.equal(config.reservedOutputTokens, 100);
  assert.equal(config.warnThreshold, 0.5);
  assert.equal(config.compactThreshold, 0.7);
  assert.equal(config.criticalThreshold, 0.9);
  assert.equal(config.recentMessageMinTokens, 200);
  assert.equal(config.summaryMaxTokens, 300);

  assert.equal(loadContextConfig({ AGENT_CONTEXT_WINDOW: '-1' }).contextWindow, 32768);
});

test('context manager estimates usage and injects compact summary', () => {
  const manager = new ContextManager({
    config: {
      contextWindow: 1000,
      reservedOutputTokens: 100,
      warnThreshold: 0.4,
      compactThreshold: 0.6,
      criticalThreshold: 0.8,
      recentMessageMinTokens: 100,
      summaryMaxTokens: 100
    }
  });
  const history: ChatMessage[] = [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'hello' }
  ];

  const result = manager.buildActiveContext({
    history,
    tools: [],
    mode: 'execute',
    compactSummary: 'Previous work summary.'
  });

  assert.equal(result.didTrim, false);
  assert.equal(result.messages[1].role, 'system');
  assert.match(result.messages[1].content, /Compacted prior session context/);
  assert.ok(result.usage.breakdown.summary > 0);
});

test('context manager injects long-term memory separately from compact summary', () => {
  const manager = new ContextManager({
    config: {
      contextWindow: 1000,
      reservedOutputTokens: 100,
      warnThreshold: 0.4,
      compactThreshold: 0.6,
      criticalThreshold: 0.8,
      recentMessageMinTokens: 100,
      summaryMaxTokens: 100
    }
  });
  const history: ChatMessage[] = [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'hello' }
  ];

  const result = manager.buildActiveContext({
    history,
    tools: [],
    mode: 'execute',
    compactSummary: 'Previous work summary.',
    memorySummary: '## Project Facts\n- Project uses NodeNext.'
  });

  assert.match(result.messages[1].content, /Compacted prior session context/);
  assert.match(result.messages[2].content, /Long-term memory/);
  assert.match(result.messages[2].content, /Project uses NodeNext/);
});

test('context manager trims old messages when estimated input exceeds budget', () => {
  const manager = new ContextManager({
    config: {
      contextWindow: 120,
      reservedOutputTokens: 20,
      warnThreshold: 0.4,
      compactThreshold: 0.6,
      criticalThreshold: 0.8,
      recentMessageMinTokens: 20,
      summaryMaxTokens: 100
    }
  });
  const history: ChatMessage[] = [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'old '.repeat(200) },
    { role: 'assistant', content: 'middle '.repeat(200) },
    { role: 'user', content: 'new request' }
  ];

  const result = manager.buildActiveContext({ history, tools: [], mode: 'execute' });

  assert.equal(result.didTrim, true);
  assert.equal(result.messages[0].role, 'system');
  assert.equal(result.messages.at(-1)?.content, 'new request');
});

test('transcript store persists agent messages as jsonl', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  const { AgentRunner } = await import('../src/agent/AgentRunner.js');
  const { readTranscriptRecords } = await import('../src/agent/context/transcriptStore.js');

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-agent-transcript-'));
  try {
    const model = {
      async chat() {
        return { content: 'Done.', toolCalls: [], stopReason: 'stop', raw: {} };
      }
    };
    const runner = new AgentRunner({
      model,
      systemPrompt: 'test system',
      workspaceRoot: workspace,
      transcriptEnabled: true
    });

    await runner.send('hello');
    const records = await readTranscriptRecords(workspace);

    assert.equal(records.length, 2);
    assert.equal(records[0].type, 'message');
    if (records[0].type === 'message') {
      assert.equal(records[0].message.role, 'user');
    }
    assert.equal(records[1].type, 'message');
    if (records[1].type === 'message') {
      assert.equal(records[1].message.role, 'assistant');
      assert.equal(records[1].message.content, 'Done.');
    }
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('compact summary persists to memories/session/compact.md', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  const { compactMemoryPath, loadCompactSummary, saveCompactSummary } = await import(
    '../src/agent/context/transcriptStore.js'
  );

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-agent-compact-summary-'));
  try {
    await saveCompactSummary(workspace, 'User goal: keep context compact.');
    const stored = await fs.readFile(compactMemoryPath(workspace), 'utf8');
    assert.match(stored, /# Compacted Session Summary/);
    assert.equal(await loadCompactSummary(workspace), 'User goal: keep context compact.');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('manual compaction stores summary and sends summary with future active context', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  const { AgentRunner } = await import('../src/agent/AgentRunner.js');
  const { loadCompactSummary, readTranscriptRecords } = await import('../src/agent/context/transcriptStore.js');

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-agent-manual-compact-'));
  try {
    const calls: ChatMessage[][] = [];
    const responses = [
      'First answer with old detail.',
      '## User Goal\nKeep the useful facts.\n\n## Current State\nReady to continue.',
      'Continued after compact.'
    ];
    const model = {
      async chat(messages: ChatMessage[]) {
        calls.push(messages);
        return { content: responses.shift() ?? 'fallback', toolCalls: [], stopReason: 'stop', raw: {} };
      }
    };
    const runner = new AgentRunner({
      model,
      systemPrompt: 'test system',
      workspaceRoot: workspace,
      transcriptEnabled: true
    });

    await runner.send('old request with lots of details');
    const result = await runner.compact({ mode: 'execute', reason: 'manual', workspaceRoot: workspace });
    await runner.send('new request');

    assert.match(result.summary, /User Goal/);
    assert.match(await loadCompactSummary(workspace), /Keep the useful facts/);
    assert.match(calls[2].map((message) => message.content).join('\n'), /Compacted prior session context/);
    assert.doesNotMatch(calls[2].map((message) => message.content).join('\n'), /old request with lots of details/);

    const records = await readTranscriptRecords(workspace);
    assert.ok(records.some((record) => record.type === 'compact'));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('auto compaction runs before model turn and preserves current user request', async () => {
  const { AgentRunner } = await import('../src/agent/AgentRunner.js');
  const calls: ChatMessage[][] = [];
  const responses = ['## User Goal\nSummarized automatically.', 'Final after auto compact.'];
  const model = {
    async chat(messages: ChatMessage[]) {
      calls.push(messages);
      return { content: responses.shift() ?? 'fallback', toolCalls: [], stopReason: 'stop', raw: {} };
    }
  };
  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    contextConfig: {
      contextWindow: 200,
      reservedOutputTokens: 50,
      warnThreshold: 0.2,
      compactThreshold: 0.3,
      criticalThreshold: 0.8,
      recentMessageMinTokens: 20,
      summaryMaxTokens: 50
    }
  });

  const events = [];
  for await (const event of runner.run(`current request ${'x'.repeat(400)}`)) {
    events.push(event.type);
  }

  assert.deepEqual(events.slice(0, 5), [
    'run_started',
    'compaction_started',
    'compaction_completed',
    'context_usage_updated',
    'model_turn_started'
  ]);
  assert.match(calls[0].map((message) => message.content).join('\n'), /Transcript to compact/);
  assert.match(calls[1].map((message) => message.content).join('\n'), /Compacted prior session context/);
  assert.match(calls[1].map((message) => message.content).join('\n'), /current request/);
});
