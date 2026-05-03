const MAX_READ_CHARS = 50_000;

export function limitLines(text: string, limit: unknown): string {
  const lines = text.split(/\r?\n/);
  const limited = Number.isInteger(limit) && Number(limit) > 0 ? lines.slice(0, Number(limit)) : lines;

  return truncate(limited.join('\n'));
}

function truncate(value: string): string {
  if (value.length <= MAX_READ_CHARS) {
    return value;
  }

  return `${value.slice(0, MAX_READ_CHARS)}\n[truncated at ${MAX_READ_CHARS} characters]`;
}
