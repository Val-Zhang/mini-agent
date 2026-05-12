import type { ChatMessage } from '../../types.js';
import type { ToolDefinition } from '../../tools/core/types.js';

const APPROX_CHARS_PER_TOKEN = 4;
const MESSAGE_OVERHEAD_TOKENS = 6;

export interface TokenEstimator {
  countText(text: string): number;
  countMessage(message: ChatMessage): number;
  countTools(tools: ToolDefinition[]): number;
}

export class ApproximateTokenEstimator implements TokenEstimator {
  countText(text: string): number {
    if (!text) {
      return 0;
    }

    return Math.max(1, Math.ceil(text.length / APPROX_CHARS_PER_TOKEN));
  }

  countMessage(message: ChatMessage): number {
    let total = MESSAGE_OVERHEAD_TOKENS + this.countText(message.role) + this.countText(message.content);
    if (message.name) {
      total += this.countText(message.name);
    }
    if (message.tool_call_id) {
      total += this.countText(message.tool_call_id);
    }
    if (message.tool_calls) {
      total += this.countText(JSON.stringify(message.tool_calls));
    }
    if (message.reasoning_content) {
      total += this.countText(message.reasoning_content);
    }
    return total;
  }

  countTools(tools: ToolDefinition[]): number {
    return tools.reduce((total, tool) => total + this.countText(JSON.stringify(tool)), 0);
  }
}
