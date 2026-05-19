import test from 'node:test';
import assert from 'node:assert/strict';

import { AgentRunner, loadMaxTurns } from '../src/agent/AgentRunner.js';
import { HookRegistry } from '../src/agent/hooks/HookRegistry.js';
import { PLAN_MODE_SYSTEM_PROMPT } from '../src/agent/prompts/plan.js';
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
      'context_usage_updated',
      'model_turn_started',
      'model_turn_completed',
      'tool_call_started',
      'permission_decided',
      'tool_call_completed',
      'context_usage_updated',
      'model_turn_started',
      'model_turn_completed',
      'run_completed'
    ]
  );
  assert.equal(events[1].type, 'context_usage_updated');
  if (events[1].type === 'context_usage_updated') {
    assert.equal(events[1].usage.status, 'normal');
  }
  assert.equal(events[3].type, 'model_turn_completed');
  if (events[3].type === 'model_turn_completed') {
    assert.equal(events[3].content, 'I need to inspect the todo list.');
    assert.equal(events[3].stopReason, 'tool_calls');
  }
  assert.equal(events[5].type, 'permission_decided');
  if (events[5].type === 'permission_decided') {
    assert.equal(events[5].decision, 'allow');
  }
  assert.equal(events[6].type, 'tool_call_completed');
  if (events[6].type === 'tool_call_completed') {
    assert.equal(events[6].content, 'todo state');
  }
});

test('asks before executing file write tools', async () => {
  let writeCalls = 0;
  const confirmations: string[] = [];
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_write',
          name: 'write_file',
          input: { path: 'a.txt', content: 'hello' }
        }
      ]
    },
    {
      content: 'Write complete.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    confirmPermission({ request }) {
      confirmations.push(request.toolCall.name);
      return true;
    },
    tools: [
      {
        name: 'write_file',
        async execute() {
          writeCalls += 1;
          return 'written';
        }
      }
    ]
  });

  const events = await collectEvents(runner.run('write a file'));

  assert.deepEqual(confirmations, ['write_file']);
  assert.equal(writeCalls, 1);
  assert.ok(events.some((event) => event.type === 'permission_decided' && event.decision === 'ask'));
});

test('does not execute ask tools when confirmation is rejected', async () => {
  let writeCalls = 0;
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_write',
          name: 'write_file',
          input: { path: 'a.txt', content: 'hello' }
        }
      ]
    },
    {
      content: 'Handled refusal.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    confirmPermission() {
      return false;
    },
    tools: [
      {
        name: 'write_file',
        async execute() {
          writeCalls += 1;
          return 'written';
        }
      }
    ]
  });

  const events = await collectEvents(runner.run('write a file'));
  const completed = events.find(
    (event) => event.type === 'tool_call_completed' && event.toolCall.id === 'call_write'
  );

  assert.equal(writeCalls, 0);
  assert.ok(completed);
  if (completed?.type === 'tool_call_completed') {
    assert.equal(completed.isError, true);
    assert.match(completed.content, /Permission denied by user/);
  }
});

test('denies dangerous bash commands before execution', async () => {
  let bashCalls = 0;
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_bash',
          name: 'bash',
          input: { command: 'rm -rf .' }
        }
      ]
    },
    {
      content: 'Refused dangerous command.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    tools: [
      {
        name: 'bash',
        async execute() {
          bashCalls += 1;
          return 'ran';
        }
      }
    ]
  });

  const events = await collectEvents(runner.run('run command'));
  const permission = events.find(
    (event) => event.type === 'permission_decided' && event.toolCall.id === 'call_bash'
  );

  assert.equal(bashCalls, 0);
  assert.ok(permission);
  if (permission?.type === 'permission_decided') {
    assert.equal(permission.decision, 'deny');
  }
});

test('approved plan allows file write tools without asking', async () => {
  let writeCalls = 0;
  let confirmCalls = 0;
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_write',
          name: 'write_file',
          input: { path: 'a.txt', content: 'hello' }
        }
      ]
    },
    {
      content: 'Implemented approved plan.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    confirmPermission() {
      confirmCalls += 1;
      return false;
    },
    tools: [
      {
        name: 'write_file',
        async execute() {
          writeCalls += 1;
          return 'written';
        }
      }
    ]
  });

  await collectEvents(runner.run('implement', { planApproved: true }));

  assert.equal(confirmCalls, 0);
  assert.equal(writeCalls, 1);
});

test('emits model delta events when stream chat is available', async () => {
  const model = new StreamingFakeModel([
    {
      deltas: ['Hello ', 'world'],
      response: {
        content: 'Hello world',
        toolCalls: [],
        stopReason: 'stop',
        raw: {}
      }
    }
  ]);
  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system'
  });

  const events = await collectEvents(runner.run('say hello'));
  assert.equal(
    events.some((event) => event.type === 'model_turn_delta' && event.contentDelta === 'Hello '),
    true
  );
  assert.equal(
    events.some((event) => event.type === 'model_turn_delta' && event.contentDelta === 'world'),
    true
  );
  assert.equal(events.at(-1)?.type, 'run_completed');
});

test('emits run_cancelled when the run signal is aborted', async () => {
  const controller = new AbortController();
  controller.abort('Run cancelled by user');
  const runner = new AgentRunner({
    model: new FakeModel([]),
    systemPrompt: 'test system'
  });

  const events = await collectEvents(runner.run('cancel me', { signal: controller.signal }));
  assert.deepEqual(
    events.map((event) => event.type),
    ['run_started', 'run_cancelled']
  );
  assert.equal(events[1].type, 'run_cancelled');
  if (events[1].type === 'run_cancelled') {
    assert.equal(events[1].reason, 'Run cancelled by user');
  }
});

test('run_started includes the selected mode', async () => {
  const runner = new AgentRunner({
    model: new FakeModel([{ content: 'done', toolCalls: [] }]),
    systemPrompt: 'test system'
  });

  const events = await collectEvents(runner.run('hi', { mode: 'plan' }));
  assert.equal(events[0].type, 'run_started');
  if (events[0].type === 'run_started') {
    assert.equal(events[0].mode, 'plan');
  }
});

test('plan mode uses plan system prompt and read-only tool visibility', async () => {
  const model = new FakeModel([{ content: 'Plan drafted.', toolCalls: [] }]);
  const runner = new AgentRunner({
    model,
    systemPrompt: 'base system',
    tools: [
      {
        name: 'read_file',
        async execute() {
          return 'read';
        }
      },
      {
        name: 'write_file',
        async execute() {
          return 'write';
        }
      },
      {
        name: 'todo_write',
        async execute() {
          return 'todo';
        }
      }
    ]
  });

  await runner.send('Make a plan', { mode: 'plan' });

  assert.equal(model.calls.length, 1);
  assert.equal(model.calls[0][1].role, 'system');
  assert.equal(model.calls[0][1].content, PLAN_MODE_SYSTEM_PROMPT);

  const visibleTools = model.options[0]?.tools?.map((tool) => tool.name).sort();
  assert.deepEqual(visibleTools, ['read_file', 'todo_write']);
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

test('task tool streams subagent progress events to parent run output', async () => {
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_task',
          name: 'task',
          input: { subagent: 'researcher', description: 'Inspect README.' }
        }
      ]
    },
    {
      content: 'Child summary',
      toolCalls: []
    },
    {
      content: 'Parent done',
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
        maxTurns: 8,
        prompt: 'general prompt'
      },
      {
        name: 'researcher',
        description: 'Read-only child agent',
        tools: [],
        maxTurns: 8,
        prompt: 'research prompt'
      }
    ]),
    maxTurns: 8
  });

  const runner = new AgentRunner({
    model,
    systemPrompt: 'parent system',
    tools: [taskTool]
  });

  const events = await collectEvents(runner.run('Delegate this.'));
  const started = events.find((event) => event.type === 'subagent_progress' && event.phase === 'started');
  const completed = events.find((event) => event.type === 'subagent_progress' && event.phase === 'completed');

  assert.ok(started);
  if (started?.type === 'subagent_progress') {
    assert.equal(started.subagent, 'researcher');
    assert.match(started.message, /正在使用 researcher subagent/);
  }

  assert.ok(completed);
  assert.equal(
    events.some(
      (event) =>
        event.type === 'subagent_progress' &&
        event.phase === 'started' &&
        event.toolCall.id === 'call_task'
    ),
    true
  );
  assert.equal(
    events.some(
      (event) =>
        event.type === 'tool_call_completed' &&
        event.toolCall.id === 'call_task' &&
        /Subtask result \(researcher\):/.test(event.content)
    ),
    true
  );
});

test('plan mode blocks side-effect tools', async () => {
  let writeCalls = 0;
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_write',
          name: 'write_file',
          input: { path: 'a.txt', content: 'hello' }
        }
      ]
    },
    {
      content: 'Plan ready.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    tools: [
      {
        name: 'write_file',
        async execute() {
          writeCalls += 1;
          return 'written';
        }
      }
    ]
  });

  const events = await collectEvents(runner.run('Create file', { mode: 'plan' }));
  const completed = events.find(
    (event) => event.type === 'tool_call_completed' && event.toolCall.id === 'call_write'
  );

  assert.equal(writeCalls, 0);
  assert.ok(completed);
  if (completed?.type === 'tool_call_completed') {
    assert.equal(completed.isError, true);
    assert.match(completed.content, /Plan mode: write_file is disabled/);
  }
});

test('plan mode still allows read-only planning tools', async () => {
  let readCalls = 0;
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [
        {
          id: 'call_read',
          name: 'read_file',
          input: { path: 'README.md' }
        }
      ]
    },
    {
      content: 'Read complete.',
      toolCalls: []
    }
  ]);

  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    tools: [
      {
        name: 'read_file',
        async execute() {
          readCalls += 1;
          return 'content';
        }
      }
    ]
  });

  const events = await collectEvents(runner.run('Read first', { mode: 'plan' }));
  const completed = events.find(
    (event) => event.type === 'tool_call_completed' && event.toolCall.id === 'call_read'
  );

  assert.equal(readCalls, 1);
  assert.ok(completed);
  if (completed?.type === 'tool_call_completed') {
    assert.equal(completed.isError, false);
    assert.equal(completed.content, 'content');
  }
});

test('runs session and tool hooks around tool execution', async () => {
  const calls: string[] = [];
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [{ id: 'call_echo', name: 'echo', input: { text: 'observed' } }]
    },
    {
      content: 'Done.',
      toolCalls: []
    }
  ]);
  const hooks = new HookRegistry([
    {
      name: 'recorder',
      onSessionStart(context) {
        calls.push(`session_start:${context.mode}`);
      },
      onPreToolUse(context) {
        calls.push(`pre:${context.toolCall.name}:${context.permission.decision}`);
      },
      onPostToolUse(context) {
        calls.push(`post:${context.toolCall.name}:${context.result.event.isError}`);
      },
      onSessionEnd(context) {
        calls.push(`session_end:${context.status}`);
      }
    }
  ]);
  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    hooks,
    tools: [
      {
        name: 'echo',
        async execute(input) {
          return String(input.text);
        }
      }
    ]
  });

  await runner.send('use tool');

  assert.deepEqual(calls, ['session_start:execute', 'pre:echo:allow', 'post:echo:false', 'session_end:completed']);
});

test('pre tool hook can block tool execution', async () => {
  let calls = 0;
  const model = new FakeModel([
    {
      content: '',
      toolCalls: [{ id: 'call_echo', name: 'echo', input: { text: 'observed' } }]
    },
    {
      content: 'Saw hook block.',
      toolCalls: []
    }
  ]);
  const runner = new AgentRunner({
    model,
    systemPrompt: 'test system',
    hooks: new HookRegistry([
      {
        name: 'blocker',
        onPreToolUse() {
          return { action: 'block', reason: 'nope' };
        }
      }
    ]),
    tools: [
      {
        name: 'echo',
        async execute() {
          calls += 1;
          return 'should not run';
        }
      }
    ]
  });

  const events = await collectEvents(runner.run('use tool'));
  const completed = events.find(
    (event) => event.type === 'tool_call_completed' && event.toolCall.id === 'call_echo'
  );

  assert.equal(calls, 0);
  assert.ok(completed);
  if (completed?.type === 'tool_call_completed') {
    assert.equal(completed.isError, true);
    assert.match(completed.content, /Blocked by hook blocker: nope/);
  }
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
  options: ModelChatOptions[];

  constructor(responses: Array<Partial<ModelResponse>>) {
    this.responses = responses;
    this.calls = [];
    this.options = [];
  }

  async chat(messages: ChatMessage[], options?: ModelChatOptions): Promise<ModelResponse> {
    this.calls.push(messages.map((message) => ({ ...message })));
    this.options.push({
      ...options,
      tools: options?.tools ? [...options.tools] : undefined
    });
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

class StreamingFakeModel {
  responses: Array<{
    deltas: string[];
    response: ModelResponse;
  }>;

  constructor(responses: Array<{ deltas: string[]; response: ModelResponse }>) {
    this.responses = responses;
  }

  async chat(): Promise<ModelResponse> {
    throw new Error('chat should not be called when streamChat is available');
  }

  async *streamChat(): AsyncGenerator<{ type: 'delta'; contentDelta: string } | { type: 'completed'; response: ModelResponse }> {
    const next = this.responses.shift();
    if (!next) {
      throw new Error('StreamingFakeModel received an unexpected call');
    }

    for (const delta of next.deltas) {
      yield { type: 'delta', contentDelta: delta };
    }

    yield { type: 'completed', response: next.response };
  }
}
