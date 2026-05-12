import type { AgentMode, ChatMessage } from '../../types.js';
import type { ToolDefinition } from '../../tools/core/types.js';
import { PLAN_MODE_SYSTEM_PROMPT } from '../prompts/plan.js';
import type { TokenEstimator } from './tokenEstimator.js';
import { ApproximateTokenEstimator } from './tokenEstimator.js';
import type { ActiveContextResult, ContextConfig, ContextUsage, ContextUsageBreakdown, ContextUsageStatus } from './types.js';

interface ContextManagerOptions {
  config: ContextConfig;
  estimator?: TokenEstimator;
}

export class ContextManager {
  private readonly config: ContextConfig;
  private readonly estimator: TokenEstimator;

  constructor({ config, estimator = new ApproximateTokenEstimator() }: ContextManagerOptions) {
    this.config = config;
    this.estimator = estimator;
  }

  getConfig(): ContextConfig {
    return { ...this.config };
  }

  estimate({ history, tools, mode, compactSummary }: BuildContextInput): ContextUsage {
    return this.calculateUsage({ messages: this.messagesWithModeAndSummary(history, mode, compactSummary), tools, compactSummary });
  }

  buildActiveContext({ history, tools, mode, compactSummary }: BuildContextInput): ActiveContextResult {
    const fullMessages = this.messagesWithModeAndSummary(history, mode, compactSummary);
    const usage = this.calculateUsage({ messages: fullMessages, tools, compactSummary });
    const usableInputTokens = Math.max(1, this.config.contextWindow - this.config.reservedOutputTokens);
    const hardBudget = Math.max(1, usableInputTokens - this.estimator.countTools(tools));

    if (usage.estimatedInputTokens <= usableInputTokens) {
      return { messages: fullMessages, usage, didTrim: false };
    }

    const trimmed = this.trimMessagesToBudget(fullMessages, hardBudget);
    return {
      messages: trimmed,
      usage: this.calculateUsage({ messages: trimmed, tools, compactSummary }),
      didTrim: true
    };
  }

  private messagesWithModeAndSummary(history: ChatMessage[], mode: AgentMode, compactSummary?: string): ChatMessage[] {
    const [first, ...rest] = history;
    const messages = first ? [{ ...first }] : [];

    if (mode === 'plan') {
      messages.push({ role: 'system', content: PLAN_MODE_SYSTEM_PROMPT });
    }

    if (compactSummary?.trim()) {
      messages.push({ role: 'system', content: `Compacted prior session context:\n\n${compactSummary.trim()}` });
    }

    messages.push(...rest.map((message) => ({ ...message })));
    return messages;
  }

  private trimMessagesToBudget(messages: ChatMessage[], budget: number): ChatMessage[] {
    const prefix = messages.filter((message, index) => index === 0 || message.role === 'system');
    const body = messages.filter((message, index) => index > 0 && message.role !== 'system');
    const prefixTokens = prefix.reduce((total, message) => total + this.estimator.countMessage(message), 0);
    const bodyBudget = Math.max(this.config.recentMessageMinTokens, budget - prefixTokens);
    const selected: ChatMessage[] = [];
    let selectedTokens = 0;

    for (let index = body.length - 1; index >= 0; index -= 1) {
      const message = body[index];
      const tokens = this.estimator.countMessage(message);
      if (selected.length > 0 && selectedTokens + tokens > bodyBudget) {
        break;
      }
      selected.unshift({ ...message });
      selectedTokens += tokens;
    }

    return [...prefix, ...selected];
  }

  private calculateUsage({ messages, tools, compactSummary }: CalculateUsageInput): ContextUsage {
    const breakdown: ContextUsageBreakdown = {
      system: 0,
      mode: 0,
      tools: this.estimator.countTools(tools),
      summary: 0,
      recentMessages: 0,
      toolResults: 0
    };

    for (const message of messages) {
      const tokens = this.estimator.countMessage(message);
      if (message.role === 'system' && message.content === PLAN_MODE_SYSTEM_PROMPT) {
        breakdown.mode += tokens;
      } else if (message.role === 'system' && compactSummary && message.content.includes(compactSummary.trim())) {
        breakdown.summary += tokens;
      } else if (message.role === 'system') {
        breakdown.system += tokens;
      } else if (message.role === 'tool') {
        breakdown.toolResults += tokens;
      } else {
        breakdown.recentMessages += tokens;
      }
    }

    const estimatedInputTokens = Object.values(breakdown).reduce((total, value) => total + value, 0);
    const usableInputTokens = Math.max(1, this.config.contextWindow - this.config.reservedOutputTokens);
    const usagePercent = estimatedInputTokens / usableInputTokens;

    return {
      contextWindow: this.config.contextWindow,
      reservedOutputTokens: this.config.reservedOutputTokens,
      usableInputTokens,
      estimatedInputTokens,
      usagePercent,
      status: statusForUsage(usagePercent, this.config),
      breakdown
    };
  }
}

interface BuildContextInput {
  history: ChatMessage[];
  tools: ToolDefinition[];
  mode: AgentMode;
  compactSummary?: string;
}

interface CalculateUsageInput {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  compactSummary?: string;
}

function statusForUsage(usagePercent: number, config: ContextConfig): ContextUsageStatus {
  if (usagePercent >= config.criticalThreshold) {
    return 'critical';
  }
  if (usagePercent >= config.compactThreshold) {
    return 'compact';
  }
  if (usagePercent >= config.warnThreshold) {
    return 'warn';
  }
  return 'normal';
}
