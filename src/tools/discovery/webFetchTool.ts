import type { ToolDefinition } from '../core/types.js';
import { webFetchSchema } from './schemas.js';
import { readIntegerInRange, requireNonEmptyString } from './utils.js';

const DEFAULT_MAX_CHARS = 6000;
const DEFAULT_TIMEOUT_MS = 10000;

export function createWebFetchTool(): ToolDefinition {
  return {
    name: 'web_fetch',
    schema: webFetchSchema,
    async execute(input, context) {
      const rawUrl = requireNonEmptyString(input.url, 'url');
      const target = normalizeHttpUrl(rawUrl);
      const maxChars = readIntegerInRange({
        value: input.max_chars,
        fallback: DEFAULT_MAX_CHARS,
        min: 200,
        max: 50000,
        fieldName: 'max_chars'
      });
      const timeoutMs = readIntegerInRange({
        value: input.timeout_ms,
        fallback: DEFAULT_TIMEOUT_MS,
        min: 1000,
        max: 60000,
        fieldName: 'timeout_ms'
      });

      const signal = combineAbortSignals(context?.signal, AbortSignal.timeout(timeoutMs));
      const response = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal
      });
      if (!response.ok) {
        throw new Error(`web_fetch failed: ${response.status} ${response.statusText}`);
      }

      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      const body = await response.text();
      const extracted = extractTextContent(body, contentType);
      const title = extractHtmlTitle(body);
      const { clipped, truncated } = truncate(extracted, maxChars);

      const lines = [
        `URL: ${target.toString()}`,
        `Final URL: ${response.url}`,
        `Status: ${response.status}`,
        `Content-Type: ${contentType || '(unknown)'}`,
        `Title: ${title || '(none)'}`,
        '',
        'Content:',
        clipped || '(empty)'
      ];
      if (truncated) {
        lines.push(`(truncated at ${maxChars} chars)`);
      }

      return lines.join('\n');
    }
  };
}

function normalizeHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('url must be a valid absolute URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('url must use http or https');
  }

  return parsed;
}

function combineAbortSignals(primary?: AbortSignal, secondary?: AbortSignal): AbortSignal | undefined {
  if (primary && secondary) {
    return AbortSignal.any([primary, secondary]);
  }

  return primary ?? secondary;
}

function extractTextContent(body: string, contentType: string): string {
  if (!body) {
    return '';
  }

  if (!contentType.includes('html')) {
    return normalizePlainText(body);
  }

  return normalizePlainText(
    decodeHtmlEntities(
      body
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|section|article|h[1-6]|tr|td)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

function extractHtmlTitle(body: string): string {
  const match = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return '';
  }

  return normalizePlainText(decodeHtmlEntities(match[1]));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizePlainText(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function truncate(value: string, maxChars: number): { clipped: string; truncated: boolean } {
  if (value.length <= maxChars) {
    return { clipped: value, truncated: false };
  }

  return {
    clipped: `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`,
    truncated: true
  };
}
