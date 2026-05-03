import test from 'node:test';
import assert from 'node:assert/strict';

import { AgentRunner, loadMaxTurns } from '../src/agent/AgentRunner.js';
import { SubagentRegistry } from '../src/agent/subagents/SubagentRegistry.js';
import { createTaskTool, loadTaskMaxTurns } from '../src/tools/task/taskTool.js';
import type { ToolDefinition } from '../src/tools/core/types.js';
import type { AgentRunEvent, ChatMessage, ModelChatOptions, ModelResponse } from '../src/types.js';

test('returns a final response when the model does not request tools', async () => {
  const model = new FakeModel([
    {
      content: 'Done.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system'
  });

  const response = await runner.send('hello');

  assert.equal(response, 'Done.');
  assert.equal(model.calls.length, 1);
  assert.deepEqual(
    runner.getHistory().map((message) => message.role),
    ['system', 'user', 'assistant']
  );
});

test('executes tool calls, appends tool results, and continues the loop', async () => {
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_1',
          name: 'echo',
          input: { text: 'observed value' }
        }
      ]
    },
    {
      content: 'I saw observed value.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    tools: [
      {
        name: 'echo',
        async execute(input) {
          return String(input.text);
        }
      }
    ]
  });

  const response = await runner.send('use a tool');
  const history = runner.getHistory();

  assert.equal(response, 'I saw observed value.');
  assert.equal(model.calls.length, 2);
  assert.deepEqual(
    history.map((message) => message.role),
    ['system', 'user', 'assistant', 'tool', 'assistant']
  );
  assert.equal(history[3].tool_call_id, 'call_1');
  assert.equal(history[3].content, 'observed value');
});

test('emits observable model and tool events with content', async () => {
  const model = new FakeModel([
    {
      content: 'I need to inspect the todo list.',
      toolCalls: [
        {
          id: 'call_1',
          name: 'echo',
          input: { text: 'todo state' }
        }
      ],
      stopReason: 'tool_calls'
    },
    {
      content: 'The todo state is visible now.',
      toolCalls: [],
      stopReason: 'stop'
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    tools: [
      {
        name: 'echo',
        async execute(input) {
          return String(input.text);
        }
      }
    ]
  });

  const events = await collectEvents(runner.run('show trace'));

  assert.deepEqual(
    events.map((event) => event.type),
    [
      'run_started',
      'model_turn_started',
      'model_turn_completed',
      'tool_call_started',
      'tool_call_completed',
      'model_turn_started',
      'model_turn_completed',
      'run_completed'
    ]
  );
  assert.equal(events[2].type, 'model_turn_completed');
  if (events[2].type === 'model_turn_completed') {
    assert.equal(events[2].content, 'I need to inspect the todo list.');
    assert.equal(events[2].stopReason, 'tool_calls');
  }
  assert.equal(events[4].type, 'tool_call_completed');
  if (events[4].type === 'tool_call_completed') {
    assert.equal(events[4].content, 'todo state');
  }
});

test('preserves provider metadata that must be replayed in assistant messages', async () => {
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_1',
          name: 'echo',
          input: { text: 'observed value' }
        }
      ],
      providerMetadata: {
        reasoningContent: 'private chain state'
      }
    },
    {
      content: 'Done.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    tools: [
      {
        name: 'echo',
        async execute(input) {
          return String(input.text);
        }
      }
    ]
  });

  await runner.send('use a tool');

  assert.equal(runner.getHistory()[2].reasoning_content, 'private chain state');
});

test('returns unknown tool errors as tool results', async () => {
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_1',
          name: 'missing_tool',
          input: {}
        }
      ]
    },
    {
      content: 'Handled the tool error.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system'
  });

  await runner.send('use a missing tool');

  const toolResult = runner.getHistory()[3];
  assert.equal(toolResult.role, 'tool');
  assert.equal(toolResult.name, 'missing_tool');
  assert.match(toolResult.content, /Unknown tool/);
});

test('task tool runs a child agent without merging child history into the parent', async () => {
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_task',
          name: 'task',
          input: { description: 'Read README and summarize the project goal.' }
        }
      ]
    },
    {
      content: 'Child summary: this is a small terminal agent project.',
      toolCalls: []
    },
    {
      content: 'Parent received the child summary.',
      toolCalls: []
    }
  ]);

  const taskTool = createTaskTool({
    model,
    createTools: () => [],
    subagents: new SubagentRegistry([
      {
        name: 'general',
        description: 'General child agent',
        tools: [],
        maxTurns: 3,
        prompt: 'child system'
      }
    ]),
    maxTurns: 3
  });
  const runner = new AgentRunner({
    model,
    systemPrompt: 'parent system',
    tools: [taskTool]
  });

  const response = await runner.send('Delegate this investigation.');
  const history = runner.getHistory();

  assert.equal(response, 'Parent received the child summary.');
  assert.deepEqual(
    history.map((message) => message.role),
    ['system', 'user', 'assistant', 'tool', 'assistant']
  );
  assert.equal(history[0].content, 'parent system');
  assert.equal(history[3].name, 'task');
  assert.match(history[3].content, /Subtask result \(general\):/);
  assert.match(history[3].content, /Child summary/);
  assert.equal(history.some((message) => message.content === 'child system'), false);

  assert.equal(model.calls.length, 3);
  assert.equal(model.calls[1][0].content, 'child system');
  assert.equal(model.calls[1][1].content, 'Read README and summarize the project goal.');
});

test('task tool selects configured subagents and applies tool allowlists', async () => {
  const model = new FakeModel([
    {
      content: 'Research summary.',
      toolCalls: []
    }
  ]);
  const createToolsCalls: Array<{ allowlist?: string[] }> = [];
  const taskTool = createTaskTool({
    model,
    createTools(options = {}) {
      createToolsCalls.push(options);
      return [
        {
          name: 'read_file',
          async execute() {
            return 'file';
          }
        },
        {
          name: 'write_file',
          async execute() {
            return 'written';
          }
        }
      ] satisfies ToolDefinition[];
    },
    subagents: new SubagentRegistry([
      {
        name: 'general',
        description: 'General child agent',
        tools: ['read_file', 'write_file'],
        maxTurns: 8,
        prompt: 'general prompt'
      },
      {
        name: 'researcher',
        description: 'Read-only child agent',
        tools: ['read_file'],
        maxTurns: 4,
        prompt: 'research prompt'
      }
    ]),
    maxTurns: 8
  });

  const result = await taskTool.execute({
    subagent: 'researcher',
    description: 'Inspect the README.'
  });

  assert.match(result, /Subtask result \(researcher\):/);
  assert.equal(model.calls[0][0].content, 'research prompt');
  assert.deepEqual(createToolsCalls, [{ allowlist: ['read_file'] }]);
});

test('task tool returns a clear error for unknown subagents', async () => {
  const taskTool = createTaskTool({
    model: new FakeModel([]),
    createTools: () => [],
    subagents: new SubagentRegistry([
      {
        name: 'general',
        description: 'General child agent',
        tools: [],
        maxTurns: 8,
        prompt: 'general prompt'
      }
    ])
  });

  const result = await taskTool.execute({
    subagent: 'missing',
    description: 'Do something.'
  });

  assert.equal(result, 'Error: unknown subagent missing. Available subagents: general');
});

test('loads max turns from environment with safe fallback', () => {
  assert.equal(loadMaxTurns({}), 24);
  assert.equal(loadMaxTurns({ AGENT_MAX_TURNS: '32' }), 32);
  assert.equal(loadMaxTurns({ AGENT_MAX_TURNS: '0' }), 24);
  assert.equal(loadMaxTurns({ AGENT_MAX_TURNS: 'bad' }), 24);
});

test('loads task max turns with safe fallback', () => {
  assert.equal(loadTaskMaxTurns({}), 8);
  assert.equal(loadTaskMaxTurns({ AGENT_MAX_TURNS: '4' }), 4);
  assert.equal(loadTaskMaxTurns({ AGENT_TASK_MAX_TURNS: '12' }), 12);
  assert.equal(loadTaskMaxTurns({ AGENT_TASK_MAX_TURNS: 'bad' }), 8);
});

async function collectEvents(events: AsyncIterable<AgentRunEvent>): Promise<AgentRunEvent[]> {
  const result: AgentRunEvent[] = [];

  for await (const event of events) {
    result.push(event);
  }

  return result;
}

class FakeModel {
  responses: Array<Partial<ModelResponse>>;
  calls: ChatMessage[][];

  constructor(responses: Array<Partial<ModelResponse>>) {
    this.responses = responses;
    this.calls = [];
  }

  async chat(messages: ChatMessage[], _options?: ModelChatOptions): Promise<ModelResponse> {
    this.calls.push(messages.map((message) => ({ ...message })));
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
