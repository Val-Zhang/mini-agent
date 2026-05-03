const DEFAULT_MAX_TURNS = 8;

export class AgentRunner {
  constructor({ model, tools = [], systemPrompt, maxTurns = DEFAULT_MAX_TURNS }) {
    this.model = model;
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
    this.maxTurns = maxTurns;
    this.history = [{ role: 'system', content: systemPrompt }];
  }

  async send(input) {
    this.history.push({ role: 'user', content: input });

    const result = await this.runLoop();
    return result.finalResponse;
  }

  async runLoop() {
    const state = {
      messages: this.history,
      turnCount: 0,
      transitionReason: 'user_message'
    };

    while (state.turnCount < this.maxTurns) {
      state.turnCount += 1;

      const response = await this.model.chat(state.messages, {
        tools: [...this.tools.values()]
      });

      state.messages.push(toAssistantMessage(response));

      if (response.toolCalls.length === 0) {
        state.transitionReason = null;
        return {
          finalResponse: response.content,
          state: snapshotState(state)
        };
      }

      const toolResults = await Promise.all(
        response.toolCalls.map((toolCall) => this.executeToolCall(toolCall))
      );

      state.messages.push(...toolResults);
      state.transitionReason = 'tool_result';
    }

    throw new Error(`Agent loop exceeded max turns (${this.maxTurns})`);
  }

  async executeToolCall(toolCall) {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return toToolResultMessage(toolCall, `Unknown tool: ${toolCall.name}`, true);
    }

    try {
      const result = await tool.execute(toolCall.input ?? {});
      return toToolResultMessage(toolCall, String(result ?? ''));
    } catch (error) {
      return toToolResultMessage(toolCall, error.message, true);
    }
  }

  getHistory() {
    return this.history.map((message) => ({ ...message }));
  }
}

function toAssistantMessage(response) {
  const message = {
    role: 'assistant',
    content: response.content
  };

  if (response.toolCalls.length > 0) {
    message.tool_calls = response.toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.input ?? {})
      }
    }));
  }

  return message;
}

function toToolResultMessage(toolCall, content, isError = false) {
  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    name: toolCall.name,
    content: isError ? `Error: ${content}` : content
  };
}

function snapshotState(state) {
  return {
    turnCount: state.turnCount,
    transitionReason: state.transitionReason,
    messageCount: state.messages.length
  };
}
