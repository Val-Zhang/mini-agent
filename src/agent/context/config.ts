import type { ContextConfig } from './types.js';

const DEFAULT_CONTEXT_WINDOW = 32768;
const DEFAULT_RESERVED_OUTPUT_TOKENS = 4096;
const DEFAULT_WARN_THRESHOLD = 0.6;
const DEFAULT_COMPACT_THRESHOLD = 0.75;
const DEFAULT_CRITICAL_THRESHOLD = 0.9;
const DEFAULT_RECENT_MESSAGE_MIN_TOKENS = 8192;
const DEFAULT_SUMMARY_MAX_TOKENS = 2048;

export function loadContextConfig(env: NodeJS.ProcessEnv = process.env): ContextConfig {
  return {
    contextWindow: readPositiveInteger(env.AGENT_CONTEXT_WINDOW, DEFAULT_CONTEXT_WINDOW),
    reservedOutputTokens: readPositiveInteger(env.AGENT_RESERVED_OUTPUT_TOKENS, DEFAULT_RESERVED_OUTPUT_TOKENS),
    warnThreshold: readThreshold(env.AGENT_WARN_THRESHOLD, DEFAULT_WARN_THRESHOLD),
    compactThreshold: readThreshold(env.AGENT_COMPACT_THRESHOLD, DEFAULT_COMPACT_THRESHOLD),
    criticalThreshold: readThreshold(env.AGENT_CRITICAL_THRESHOLD, DEFAULT_CRITICAL_THRESHOLD),
    recentMessageMinTokens: readPositiveInteger(env.AGENT_RECENT_MESSAGE_MIN_TOKENS, DEFAULT_RECENT_MESSAGE_MIN_TOKENS),
    summaryMaxTokens: readPositiveInteger(env.AGENT_SUMMARY_MAX_TOKENS, DEFAULT_SUMMARY_MAX_TOKENS)
  };
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function readThreshold(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
    return fallback;
  }

  return parsed;
}
