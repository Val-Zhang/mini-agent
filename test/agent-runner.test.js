import test from 'node:test';
import assert from 'node:assert/strict';

import { AgentRunner } from '../src/agent/AgentRunner.js';

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
          return input.text;
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
          return input.text;
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

class FakeModel {
  constructor(responses) {
    this.responses = responses;
    this.calls = [];
  }

  async chat(messages) {
    this.calls.push(messages.map((message) => ({ ...message })));
    const response = this.responses.shift();

    if (!response) {
      throw new Error('FakeModel received an unexpected call');
    }

    return {
      stopReason: null,
      raw: {},
      ...response
    };
  }
}
