export const MAX_VERBOSE_BLOCK_CHARS = 4_000;
export const MAX_MODEL_SUMMARY_CHARS = 600;

export function indent(value: string): string {
  return value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

export function clip(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n[truncated at ${maxChars} chars]`;
}

export function firstMeaningfulLine(value: string): string {
  const line = value
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean);

  return line ?? '';
}

export function formatBlock(label: string, value: string, maxChars = MAX_VERBOSE_BLOCK_CHARS): string {
  return `${label}>\n${indent(clip(value, maxChars))}\n`;
}
