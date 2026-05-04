import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { PathSandbox } from '../core/pathSandbox.js';
import type { ToolDefinition } from '../core/types.js';
import { listDirSchema } from './schemas.js';
import { readBoolean, readIntegerInRange, readOptionalPath, toWorkspaceRelativePath } from './utils.js';

interface ListDirEntry {
  type: 'dir' | 'file' | 'symlink' | 'other';
  path: string;
}

export function createListDirTool({ sandbox }: { sandbox: PathSandbox }): ToolDefinition {
  return {
    name: 'list_dir',
    schema: listDirSchema,
    async execute(input) {
      const requestedPath = readOptionalPath(input.path, '.');
      const depth = readIntegerInRange({
        value: input.depth,
        fallback: 1,
        min: 1,
        max: 8,
        fieldName: 'depth'
      });
      const includeHidden = readBoolean(input.include_hidden, false);
      const maxEntries = readIntegerInRange({
        value: input.max_entries,
        fallback: 200,
        min: 1,
        max: 2000,
        fieldName: 'max_entries'
      });

      const startAbs = sandbox.resolvePath(requestedPath);
      const { entries, truncated } = await collectEntries({
        sandbox,
        startAbs,
        depth,
        includeHidden,
        maxEntries
      });

      if (entries.length === 0) {
        return `Directory ${requestedPath} has no entries (with current filters).`;
      }

      const lines = [
        `Directory: ${requestedPath}`,
        `Entries: ${entries.length}${truncated ? '+' : ''}`,
        ...entries.map((entry) => `- [${entry.type}] ${entry.path}`)
      ];
      if (truncated) {
        lines.push(`(truncated at ${maxEntries} entries)`);
      }

      return lines.join('\n');
    }
  };
}

async function collectEntries({
  sandbox,
  startAbs,
  depth,
  includeHidden,
  maxEntries
}: {
  sandbox: PathSandbox;
  startAbs: string;
  depth: number;
  includeHidden: boolean;
  maxEntries: number;
}): Promise<{ entries: ListDirEntry[]; truncated: boolean }> {
  const queue: Array<{ absPath: string; level: number }> = [{ absPath: startAbs, level: 0 }];
  const result: ListDirEntry[] = [];

  while (queue.length > 0 && result.length < maxEntries) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    const dirents = await readdir(current.absPath, { withFileTypes: true });
    dirents.sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of dirents) {
      if (!includeHidden && dirent.name.startsWith('.')) {
        continue;
      }

      const childAbs = path.join(current.absPath, dirent.name);
      const relativePath = toWorkspaceRelativePath(sandbox, childAbs);
      if (relativePath === null) {
        continue;
      }

      const type = classifyDirent(dirent);
      result.push({ type, path: relativePath });

      if (result.length >= maxEntries) {
        break;
      }

      if (type === 'dir' && current.level + 1 < depth) {
        queue.push({ absPath: childAbs, level: current.level + 1 });
      }
    }
  }

  return {
    entries: result,
    truncated: result.length >= maxEntries
  };
}

function classifyDirent(dirent: { isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean }): ListDirEntry['type'] {
  if (dirent.isDirectory()) {
    return 'dir';
  }

  if (dirent.isFile()) {
    return 'file';
  }

  if (dirent.isSymbolicLink()) {
    return 'symlink';
  }

  return 'other';
}
