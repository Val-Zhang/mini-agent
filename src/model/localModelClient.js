export class LocalModelClient {
  constructor({ baseUrl, model, apiKey }) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
  }

  async chat(messages, options = {}) {
    const body = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.2,
      stream: false
    };

    const tools = toOpenAICompatibleTools(options.tools ?? []);
    if (tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Local model request failed: ${response.status} ${body}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = message?.content ?? '';

    if (typeof content !== 'string') {
      throw new Error('Local model response did not include choices[0].message.content');
    }

    return {
      content,
      toolCalls: normalizeToolCalls(message?.tool_calls ?? []),
      stopReason: choice?.finish_reason ?? null,
      providerMetadata: {
        reasoningContent: message?.reasoning_content
      },
      raw: data
    };
  }

  capabilities() {
    return {
      streaming: false,
      toolCalling: true,
      jsonMode: false,
      reasoning: false
    };
  }
}

function toOpenAICompatibleTools(tools) {
  return tools
    .map((tool) => tool.schema)
    .filter(Boolean)
    .map((schema) => ({
      type: 'function',
      function: schema
    }));
}

function normalizeToolCalls(toolCalls) {
  return toolCalls.map((toolCall) => ({
    id: toolCall.id,
    name: toolCall.function?.name,
    input: parseToolArguments(toolCall.function?.arguments)
  }));
}

function parseToolArguments(value) {
  if (!value) {
    return {};
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}
