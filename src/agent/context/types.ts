import type { ChatMessage } from '../../types.js';

export type ContextUsageStatus = 'normal' | 'warn' | 'compact' | 'critical';

export interface ContextConfig {
  contextWindow: number;
  reservedOutputTokens: number;
  warnThreshold: number;
  compactThreshold: number;
  criticalThreshold: number;
  recentMessageMinTokens: number;
  summaryMaxTokens: number;
}

export interface ContextUsageBreakdown {
  system: number;
  mode: number;
  tools: number;
  summary: number;
  recentMessages: number;
  toolResults: number;
}

export interface ContextUsage {
  contextWindow: number;
  reservedOutputTokens: number;
  usableInputTokens: number;
  estimatedInputTokens: number;
  usagePercent: number;
  status: ContextUsageStatus;
  breakdown: ContextUsageBreakdown;
}

export interface ActiveContextResult {
  messages: ChatMessage[];
  usage: ContextUsage;
  didTrim: boolean;
}
