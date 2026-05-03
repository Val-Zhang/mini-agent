import { readFile } from 'node:fs/promises';

export async function loadEnvFile(path = '.env', target: NodeJS.ProcessEnv = process.env): Promise<void> {
  let content: string;

  try {
    content = await readFile(path, 'utf8');
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }

  for (const [key, value] of parseEnvFile(content)) {
    if (target[key] === undefined) {
      target[key] = value;
    }
  }
}

export function parseEnvFile(content: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    entries.push([key, unquote(rawValue)]);
  }

  return entries;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
