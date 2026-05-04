import path from 'node:path';
import fg from 'fast-glob';

import type { PathSandbox } from '../core/pathSandbox.js';
import type { ToolDefinition } from '../core/types.js';
import { globSchema } from './schemas.js';
import {
  readBoolean,
  readIntegerInRange,
  readOptionalPath,
  readStringArray,
  requireNonEmptyString,
  toWorkspaceRelativePath
} from './utils.js';

export function createGlobTool({ sandbox }: { sandbox: PathSandbox }): ToolDefinition {
  return {
    name: 'glob',
    schema: globSchema,
    async execute(input, context) {
      const pattern = requireNonEmptyString(input.pattern, 'pattern');
      const requestedPath = readOptionalPath(input.path, '.');
      const includeHidden = readBoolean(input.include_hidden, false);
      const ignore = readStringArray(input.ignore, 'ignore');
      const maxResults = readIntegerInRange({
        value: input.max_results,
        fallback: 200,
        min: 1,
        max: 5000,
        fieldName: 'max_results'
      });

      const cwd = sandbox.resolvePath(requestedPath);
      const rawMatches = await fg.glob(pattern, {
        cwd,
        dot: includeHidden,
        ignore,
        onlyFiles: false,
        followSymbolicLinks: false,
        unique: true,
        suppressErrors: true
      });
      rawMatches.sort((a, b) => a.localeCompare(b));

      const normalizedMatches: string[] = [];
      for (const match of rawMatches) {
        const resolved = path.resolve(cwd, match);
        const relativePath = toWorkspaceRelativePath(sandbox, resolved);
        if (relativePath === null) {
          continue;
        }

        normalizedMatches.push(relativePath);
      }

      const shown = normalizedMatches.slice(0, maxResults);
      const truncated = normalizedMatches.length > maxResults;
      if (shown.length === 0) {
        return `No matches for pattern "${pattern}" under ${requestedPath}.`;
      }

      const lines = [
        `Pattern: ${pattern}`,
        `Base path: ${requestedPath}`,
        `Matches: ${shown.length}${truncated ? ` of ${normalizedMatches.length}` : ''}`,
        ...shown.map((value) => `- ${value}`)
      ];
      if (truncated) {
        lines.push(`(truncated at ${maxResults} results)`);
      }

      return lines.join('\n');
    }
  };
}
