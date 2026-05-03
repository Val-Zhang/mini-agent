import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { SubagentRegistry } from './SubagentRegistry.js';
import { DEFAULT_SUBAGENTS } from './defaults.js';
import { parseMarkdownWithFrontmatter } from './frontmatter.js';
import type { SubagentConfig } from './types.js';

export async function loadSubagentRegistry({
  workspaceRoot,
  directory = 'subagents'
}: {
  workspaceRoot: string;
  directory?: string;
}): Promise<SubagentRegistry> {
  const directoryPath = join(workspaceRoot, directory);
  const files = await readSubagentFiles(directoryPath);

  if (files.length === 0) {
    return new SubagentRegistry(DEFAULT_SUBAGENTS);
  }

  const configs = await Promise.all(
    files.map(async (fileName) => {
      const content = await readFile(join(directoryPath, fileName), 'utf8');
      return parseSubagentMarkdown(content, fileName);
    })
  );

  return new SubagentRegistry(configs);
}

export function parseSubagentMarkdown(content: string, source = '<inline>'): SubagentConfig {
  const { attributes, body } = parseMarkdownWithFrontmatter(content);
  const name = requireString(attributes.name, 'name', source);
  const description = requireString(attributes.description, 'description', source);
  const tools = requireStringArray(attributes.tools, 'tools', source);
  const maxTurns = requirePositiveInteger(attributes.maxTurns, 'maxTurns', source);

  if (!body) {
    throw new Error(`Subagent ${source} must include a prompt body`);
  }

  return {
    name,
    description,
    tools,
    maxTurns,
    prompt: body
  };
}

async function readSubagentFiles(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort();
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function requireString(value: unknown, field: string, source: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Subagent ${source} must define string field: ${field}`);
  }

  return value.trim();
}

function requireStringArray(value: unknown, field: string, source: string): string[] {
  const hasInvalidItem =
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'string' || item.trim() === '');

  if (hasInvalidItem) {
    throw new Error(`Subagent ${source} must define non-empty string array field: ${field}`);
  }

  return value.map((item) => item.trim());
}

function requirePositiveInteger(value: unknown, field: string, source: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`Subagent ${source} must define positive integer field: ${field}`);
  }

  return Number(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
