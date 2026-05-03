import matter from 'gray-matter';

interface ParsedMarkdown {
  attributes: Record<string, unknown>;
  body: string;
}

export function parseMarkdownWithFrontmatter(content: string): ParsedMarkdown {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    throw new Error('Subagent file must start with frontmatter');
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(normalized);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid subagent frontmatter: ${reason}`);
  }

  return {
    attributes: ensureFrontmatterObject(parsed.data),
    body: parsed.content.trim()
  };
}

function ensureFrontmatterObject(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  throw new Error('Subagent frontmatter must be a YAML object');
}
