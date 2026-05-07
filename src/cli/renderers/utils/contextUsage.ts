import type { ContextUsage } from '../../../types.js';

export function formatContextUsageLine(usage: ContextUsage): string {
  const percent = Math.round(usage.usagePercent * 100);
  return `${barForPercent(usage.usagePercent)} ${percent}% ${formatTokens(usage.estimatedInputTokens)}/${formatTokens(usage.usableInputTokens)} tokens (${usage.status})`;
}

export function formatContextUsageDetails(usage: ContextUsage): string {
  const lines = [
    `usage: ${usage.estimatedInputTokens} / ${usage.usableInputTokens} tokens (${Math.round(usage.usagePercent * 100)}%)`,
    `window: ${usage.contextWindow}`,
    `reserved output: ${usage.reservedOutputTokens}`,
    'breakdown:',
    `  system: ${usage.breakdown.system}`,
    `  mode: ${usage.breakdown.mode}`,
    `  tools: ${usage.breakdown.tools}`,
    `  summary: ${usage.breakdown.summary}`,
    `  recent messages: ${usage.breakdown.recentMessages}`,
    `  tool results: ${usage.breakdown.toolResults}`,
    `status: ${usage.status}`
  ];
  return lines.join('\n');
}

function barForPercent(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  const filled = Math.round(clamped * 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

function formatTokens(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}
