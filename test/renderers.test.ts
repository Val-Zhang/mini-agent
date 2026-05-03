import test from 'node:test';
import assert from 'node:assert/strict';

import { createRenderer, loadSubagentTraceMode, loadTraceMode } from '../src/cli/renderers/createRenderer.js';
import type { AgentRunEvent } from '../src/types.js';

test('loads trace mode with compact fallback', () => {
  assert.equal(loadTraceMode({}), 'compact');
  assert.equal(loadTraceMode({ AGENT_TRACE: 'verbose' }), 'verbose');
  assert.equal(loadTraceMode({ AGENT_TRACE: 'off' }), 'off');
  assert.equal(loadTraceMode({ AGENT_TRACE: 'unknown' }), 'compact');
});

test('loads subagent trace mode with compact fallback', () => {
  assert.equal(loadSubagentTraceMode({}), 'compact');
  assert.equal(loadSubagentTraceMode({ AGENT_SUBAGENT_TRACE: 'verbose' }), 'verbose');
  assert.equal(loadSubagentTraceMode({ AGENT_SUBAGENT_TRACE: 'off' }), 'off');
  assert.equal(loadSubagentTraceMode({ AGENT_SUBAGENT_TRACE: 'unknown' }), 'compact');
});

test('compact renderer summarizes model and todo events', () => {
  const output = new MemoryOutput();
  const renderer = createRenderer({ mode: 'compact', output });

  for (const event of todoEvents()) {
    renderer.render(event);
  }

  const text = output.toString();
  assert.match(text, /agent> 发送中/);
  assert.match(text, /\[1\] 模型/);
  assert.match(text, /model>\n  我会先创建任务。/);
  assert.match(text, /· todo add\s+读取 README 前 5 行/);
  assert.match(text, /✓ todo_write/);
  assert.match(text, /Todo\n  → 读取 README 前 5 行/);
  assert.match(text, /agent>\ndone/);
});

test('verbose renderer includes full tool input and output', () => {
  const output = new MemoryOutput();
  const renderer = createRenderer({ mode: 'verbose', output });

  for (const event of todoEvents()) {
    renderer.render(event);
  }

  const text = output.toString();
  assert.match(text, /trace> 模型第 1 轮结束/);
  assert.match(text, /input>\n  \{/);
  assert.match(text, /"action": "add"/);
  assert.match(text, /output>\n  Added todo/);
});

test('verbose renderer shows model delta stream output', () => {
  const output = new MemoryOutput();
  const renderer = createRenderer({ mode: 'verbose', output });

  for (const event of streamingEvents()) {
    renderer.render(event);
  }

  const text = output.toString();
  assert.match(text, /delta>\n  Hello /);
  assert.match(text, /delta>\n  world/);
});

test('renderers show subagent delegation summary for task tool', () => {
  const compactOutput = new MemoryOutput();
  const compactRenderer = createRenderer({ mode: 'compact', output: compactOutput });
  const verboseOutput = new MemoryOutput();
  const verboseRenderer = createRenderer({ mode: 'verbose', output: verboseOutput });

  for (const event of taskEvents()) {
    compactRenderer.render(event);
    verboseRenderer.render(event);
  }

  assert.match(compactOutput.toString(), /正在使用 researcher subagent，帮你 Inspect README and summarize architecture\./);
  assert.match(verboseOutput.toString(), /trace> 正在使用 researcher subagent，帮你 Inspect README and summarize architecture\./);
  assert.match(compactOutput.toString(), /\[researcher\] 模型第 1 轮/);
  assert.match(verboseOutput.toString(), /subagent> \[researcher\] 模型第 1 轮/);
  assert.match(verboseOutput.toString(), /subagent> \[researcher\] ✓ read_file \(7ms\)/);
  assert.match(compactOutput.toString(), /完成（0s，1 轮，1 次工具调用，0 次失败）/);
  assert.match(verboseOutput.toString(), /完成（0s，1 轮，1 次工具调用，0 次失败）/);
});

test('subagent trace mode off hides subagent progress', () => {
  const output = new MemoryOutput();
  const renderer = createRenderer({ mode: 'compact', subagentTraceMode: 'off', output });

  for (const event of taskEvents()) {
    renderer.render(event);
  }

  const text = output.toString();
  assert.match(text, /正在使用 researcher subagent/);
  assert.doesNotMatch(text, /\[researcher\] 模型第/);
  assert.doesNotMatch(text, /✓ \[researcher\]/);
  assert.doesNotMatch(text, /完成（/);
});

test('compact subagent trace throttles model turn chatter', () => {
  const output = new MemoryOutput();
  const renderer = createRenderer({ mode: 'compact', subagentTraceMode: 'compact', output });

  for (const event of taskEventsWithManyTurns()) {
    renderer.render(event);
  }

  const text = output.toString();
  assert.match(text, /\[researcher\] 模型第 1 轮/);
  assert.doesNotMatch(text, /\[researcher\] 模型第 2 轮/);
  assert.match(text, /\[researcher\] 模型第 3 轮/);
});

test('silent renderer hides events but keeps final answer', () => {
  const output = new MemoryOutput();
  const renderer = createRenderer({ mode: 'off', output });

  for (const event of todoEvents()) {
    renderer.render(event);
  }

  const text = output.toString();
  assert.match(text, /agent> 发送中/);
  assert.doesNotMatch(text, /todo add/);
  assert.match(text, /agent> done/);
});

test('renderers show cancellation message', () => {
  const output = new MemoryOutput();
  const renderer = createRenderer({ mode: 'compact', output });

  for (const event of cancelledEvents()) {
    renderer.render(event);
  }

  const text = output.toString();
  assert.match(text, /cancelled> Run cancelled by user/);
});

function todoEvents(): AgentRunEvent[] {
  return [
    { type: 'run_started', input: 'message' },
    { type: 'model_turn_started', turnCount: 1 },
    {
      type: 'model_turn_completed',
      turnCount: 1,
      content: '我会先创建任务。\n然后继续。',
      stopReason: 'tool_calls',
      toolCalls: [
        {
          id: 'call_1',
          name: 'todo_write',
          input: {
            action: 'add',
            description: '读取 README 前 5 行'
          }
        }
      ]
    },
    {
      type: 'tool_call_started',
      toolCall: {
        id: 'call_1',
        name: 'todo_write',
        input: {
          action: 'add',
          description: '读取 README 前 5 行'
        }
      }
    },
    {
      type: 'tool_call_completed',
      toolCall: {
        id: 'call_1',
        name: 'todo_write',
        input: {
          action: 'add',
          description: '读取 README 前 5 行'
        }
      },
      isError: false,
      content: 'Added todo: [todo-1] 读取 README 前 5 行',
      durationMs: 3
    },
    {
      type: 'tool_call_completed',
      toolCall: {
        id: 'call_2',
        name: 'todo_write',
        input: { action: 'list' }
      },
      isError: false,
      content: 'Current todos:\n  → [todo-1] 读取 README 前 5 行 [FOCUS]\n\nSummary: 0 pending, 1 in progress, 0 completed',
      durationMs: 2
    },
    { type: 'run_completed', content: 'done' }
  ];
}

function taskEvents(): AgentRunEvent[] {
  return [
    { type: 'run_started', input: 'message' },
    { type: 'model_turn_started', turnCount: 1 },
    {
      type: 'model_turn_completed',
      turnCount: 1,
      content: 'I will delegate this.',
      stopReason: 'tool_calls',
      toolCalls: [
        {
          id: 'call_task_1',
          name: 'task',
          input: {
            subagent: 'researcher',
            description: 'Inspect README and summarize architecture.'
          }
        }
      ]
    },
    {
      type: 'tool_call_started',
      toolCall: {
        id: 'call_task_1',
        name: 'task',
        input: {
          subagent: 'researcher',
          description: 'Inspect README and summarize architecture.'
        }
      }
    },
    {
      type: 'subagent_progress',
      toolCall: {
        id: 'call_task_1',
        name: 'task',
        input: {
          subagent: 'researcher',
          description: 'Inspect README and summarize architecture.'
        }
      },
      subagent: 'researcher',
      phase: 'started',
      message: '正在使用 researcher subagent，帮你 Inspect README and summarize architecture.'
    },
    {
      type: 'subagent_progress',
      toolCall: {
        id: 'call_task_1',
        name: 'task',
        input: {
          subagent: 'researcher',
          description: 'Inspect README and summarize architecture.'
        }
      },
      subagent: 'researcher',
      phase: 'model_turn_started',
      message: '模型第 1 轮',
      turnCount: 1
    },
    {
      type: 'subagent_progress',
      toolCall: {
        id: 'call_task_1',
        name: 'task',
        input: {
          subagent: 'researcher',
          description: 'Inspect README and summarize architecture.'
        }
      },
      subagent: 'researcher',
      phase: 'tool_call_started',
      message: '调用 read_file',
      toolName: 'read_file'
    },
    {
      type: 'subagent_progress',
      toolCall: {
        id: 'call_task_1',
        name: 'task',
        input: {
          subagent: 'researcher',
          description: 'Inspect README and summarize architecture.'
        }
      },
      subagent: 'researcher',
      phase: 'tool_call_completed',
      message: '完成 read_file',
      toolName: 'read_file',
      durationMs: 7,
      isError: false
    },
    {
      type: 'subagent_progress',
      toolCall: {
        id: 'call_task_1',
        name: 'task',
        input: {
          subagent: 'researcher',
          description: 'Inspect README and summarize architecture.'
        }
      },
      subagent: 'researcher',
      phase: 'completed',
      message: '执行完成（1 轮，1 次工具调用）',
      modelTurns: 1,
      toolCalls: 1,
      elapsedMs: 21
    },
    {
      type: 'tool_call_completed',
      toolCall: {
        id: 'call_task_1',
        name: 'task',
        input: {
          subagent: 'researcher',
          description: 'Inspect README and summarize architecture.'
        }
      },
      isError: false,
      content: 'Subtask result (researcher):\nSummary',
      durationMs: 12
    },
    { type: 'run_completed', content: 'done' }
  ];
}

function taskEventsWithManyTurns(): AgentRunEvent[] {
  return [
    { type: 'run_started', input: 'message' },
    { type: 'model_turn_started', turnCount: 1 },
    {
      type: 'model_turn_completed',
      turnCount: 1,
      content: 'I will delegate this.',
      stopReason: 'tool_calls',
      toolCalls: []
    },
    {
      type: 'subagent_progress',
      toolCall: { id: 'call_task_1', name: 'task', input: {} },
      subagent: 'researcher',
      phase: 'model_turn_started',
      message: '模型第 1 轮',
      turnCount: 1
    },
    {
      type: 'subagent_progress',
      toolCall: { id: 'call_task_1', name: 'task', input: {} },
      subagent: 'researcher',
      phase: 'model_turn_started',
      message: '模型第 2 轮',
      turnCount: 2
    },
    {
      type: 'subagent_progress',
      toolCall: { id: 'call_task_1', name: 'task', input: {} },
      subagent: 'researcher',
      phase: 'model_turn_started',
      message: '模型第 3 轮',
      turnCount: 3
    },
    { type: 'run_completed', content: 'done' }
  ];
}

function streamingEvents(): AgentRunEvent[] {
  return [
    { type: 'run_started', input: 'message' },
    { type: 'model_turn_started', turnCount: 1 },
    { type: 'model_turn_delta', turnCount: 1, contentDelta: 'Hello ' },
    { type: 'model_turn_delta', turnCount: 1, contentDelta: 'world' },
    {
      type: 'model_turn_completed',
      turnCount: 1,
      content: 'Hello world',
      stopReason: 'stop',
      toolCalls: []
    },
    { type: 'run_completed', content: 'Hello world' }
  ];
}

function cancelledEvents(): AgentRunEvent[] {
  return [
    { type: 'run_started', input: 'message' },
    { type: 'run_cancelled', reason: 'Run cancelled by user' }
  ];
}

class MemoryOutput {
  private value = '';

  write(value: string): void {
    this.value += value;
  }

  toString(): string {
    return this.value;
  }
}
