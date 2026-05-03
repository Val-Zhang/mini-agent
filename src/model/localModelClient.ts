import type {
  ChatMessage,
  ModelCapabilities,
  ModelChatOptions,
  ModelClient,
  ModelResponse,
  ModelStreamEvent
} from '../types.js';
import { toOpenAICompatibleTools } from './utils/openAICompatible.js';
import { normalizeChatCompletionResponse } from './utils/response.js';
import { streamChatCompletionResponse } from './utils/stream.js';

interface LocalModelClientOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
}

interface ChatCompletionRequestBody {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  stream: boolean;
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
    const body = this.createRequestBody(messages, options, false);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Local model request failed: ${response.status} ${bodyText}`);
    }

    return normalizeChatCompletionResponse(await response.json());
  }

  async *streamChat(messages: ChatMessage[], options: ModelChatOptions = {}): AsyncGenerator<ModelStreamEvent> {
    const body = this.createRequestBody(messages, options, true);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      if (supportsStreamFallback(response.status)) {
        const fallback = await this.chat(messages, options);
        yield { type: 'completed', response: fallback };
        return;
      }

      const bodyText = await response.text();
      throw new Error(`Local model stream request failed: ${response.status} ${bodyText}`);
    }

    yield* streamChatCompletionResponse(response);
  }

  capabilities(): ModelCapabilities {
    return {
      streaming: true,
      toolCalling: true,
      jsonMode: false,
      reasoning: false
    };
  }

  private createRequestBody(
    messages: ChatMessage[],
    options: ModelChatOptions,
    stream: boolean
  ): ChatCompletionRequestBody {
    const body: ChatCompletionRequestBody = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.2,
      stream
    };

    const tools = toOpenAICompatibleTools(options.tools ?? []);
    if (tools.length > 0) {
      body.tools = tools;
    }

    return body;
  }
}

function supportsStreamFallback(status: number): boolean {
  return status === 400 || status === 404 || status === 405 || status === 422 || status === 501;
}
