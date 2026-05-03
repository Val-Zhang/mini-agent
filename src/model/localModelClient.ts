import type { ChatMessage, ModelCapabilities, ModelChatOptions, ModelClient, ModelResponse } from '../types.js';
import { toOpenAICompatibleTools } from './utils/openAICompatible.js';
import { normalizeChatCompletionResponse } from './utils/response.js';

interface LocalModelClientOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
}

interface ChatCompletionRequestBody {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  stream: false;
  tools?: ReturnType<typeof toOpenAICompatibleTools>;
}

export class LocalModelClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor({ baseUrl, model, apiKey }: LocalModelClientOptions) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[], options: ModelChatOptions = {}): Promise<ModelResponse> {
    const body = this.createRequestBody(messages, options);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Local model request failed: ${response.status} ${bodyText}`);
    }

    return normalizeChatCompletionResponse(await response.json());
  }

  capabilities(): ModelCapabilities {
    return {
      streaming: false,
      toolCalling: true,
      jsonMode: false,
      reasoning: false
    };
  }

  private createRequestBody(messages: ChatMessage[], options: ModelChatOptions): ChatCompletionRequestBody {
    const body: ChatCompletionRequestBody = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.2,
      stream: false
    };

    const tools = toOpenAICompatibleTools(options.tools ?? []);
    if (tools.length > 0) {
      body.tools = tools;
    }

    return body;
  }
}
