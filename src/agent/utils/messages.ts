import type { ChatMessage, ModelResponse, ToolCall } from '../../types.js';

export function toAssistantMessage(response: ModelResponse): ChatMessage {
  const message: ChatMessage = {
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

  if (typeof response.providerMetadata?.reasoningContent === 'string') {
    message.reasoning_content = response.providerMetadata.reasoningContent;
  }

  return message;
}

export function toToolResultMessage(
  toolCall: ToolCall,
  content: string,
  isError = false
): ChatMessage {
  return {
    role: 'tool',
    tool_call_id: toolCall.id,
    name: toolCall.name,
    content: isError ? `Error: ${content}` : content
  };
}
