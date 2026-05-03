import test from 'node:test';
import assert from 'node:assert/strict';

import { createRenderer, loadTraceMode } from '../src/cli/renderers/createRenderer.js';
import type { AgentRunEvent } from '../src/types.js';

test('loads trace mode with compact fallback', () => {
  assert.equal(loadTraceMode({}), 'compact');
  assert.equal(loadTraceMode({ AGENT_TRACE: 'verbose' }), 'verbose');
  assert.equal(loadTraceMode({ AGENT_TRACE: 'off' }), 'off');
  assert.equal(loadTraceMode({ AGENT_TRACE: 'unknown' }), 'compact');
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

class MemoryOutput {
  private value = '';

  write(value: string): void {
    this.value += value;
  }

  toString(): string {
    return this.value;
  }
}
