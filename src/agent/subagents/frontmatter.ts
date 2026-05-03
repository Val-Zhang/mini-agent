interface ParsedMarkdown {
  attributes: Record<string, unknown>;
  body: string;
}

export function parseMarkdownWithFrontmatter(content: string): ParsedMarkdown {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0] !== '---') {
    throw new Error('Subagent file must start with frontmatter');
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === '---');
  if (closingIndex === -1) {
    throw new Error('Subagent frontmatter is not closed');
  }

  const frontmatter = lines.slice(1, closingIndex).join('\n').trim();
  const body = lines.slice(closingIndex + 1).join('\n').trim();

  return {
    attributes: parseSimpleYaml(frontmatter),
    body
  };
}

function parseSimpleYaml(value: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = value.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid frontmatter line: ${line}`);
    }

    const [, key, rawValue] = match;
    if (rawValue === '') {
      const items: string[] = [];
      while (index + 1 < lines.length) {
        const next = lines[index + 1];
        const itemMatch = next.match(/^\s+-\s+(.+)$/);
        if (!itemMatch) {
          break;
        }

        items.push(stripQuotes(itemMatch[1].trim()));
        index += 1;
      }

      result[key] = items;
      continue;
    }

    result[key] = parseScalar(rawValue.trim());
  }

  return result;
}

function parseScalar(value: string): string | number | boolean {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return stripQuotes(value);
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
