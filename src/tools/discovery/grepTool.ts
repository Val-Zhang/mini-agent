import { execFile } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';
import path from 'node:path';

import type { PathSandbox } from '../core/pathSandbox.js';
import type { ToolDefinition } from '../core/types.js';
import { grepSchema } from './schemas.js';
import {
  readBoolean,
  readIntegerInRange,
  readOptionalPath,
  readStringArray,
  requireNonEmptyString,
  toWorkspaceRelativePath
} from './utils.js';

const MAX_BUFFER_BYTES = 12 * 1024 * 1024;

interface GrepMatch {
  path: string;
  line: number;
  column: number;
  snippet: string;
}

interface RipgrepJsonMessage {
  type?: string;
  data?: {
    path?: JsonDataValue;
    lines?: JsonDataValue;
    line_number?: number;
    submatches?: Array<{
      start?: number;
      match?: JsonDataValue;
    }>;
  };
}

interface JsonDataValue {
  text?: string;
  bytes?: string;
}

export function createGrepTool({ sandbox }: { sandbox: PathSandbox }): ToolDefinition {
  return {
    name: 'grep',
    schema: grepSchema,
    async execute(input, context) {
      const pattern = requireNonEmptyString(input.pattern, 'pattern');
      const requestedPath = readOptionalPath(input.path, '.');
      const glob = readStringArray(input.glob, 'glob');
      const includeHidden = readBoolean(input.include_hidden, false);
      const caseSensitive = readBoolean(input.case_sensitive, true);
      const maxResults = readIntegerInRange({
        value: input.max_results,
        fallback: 200,
        min: 1,
        max: 5000,
        fieldName: 'max_results'
      });

      const searchRoot = sandbox.resolvePath(requestedPath);
      const args = createRipgrepArgs({
        pattern,
        glob,
        includeHidden,
        caseSensitive
      });
      const { stdout, stderr } = await runRipgrep(args, searchRoot, context?.signal);
      const parsed = parseRipgrepMatches(stdout, sandbox, searchRoot);
      const shown = parsed.matches.slice(0, maxResults);
      const truncated = parsed.matches.length > maxResults;

      if (shown.length === 0) {
        return `No matches for pattern "${pattern}" under ${requestedPath}.`;
      }

      const lines = [
        `Pattern: ${pattern}`,
        `Search path: ${requestedPath}`,
        `Matches: ${shown.length}${truncated ? ` of ${parsed.matches.length}` : ''}`,
        `Files: ${countDistinctFiles(shown)}`,
        ...shown.map((match) => `- ${match.path}:${match.line}:${match.column} | ${match.snippet}`)
      ];
      if (truncated) {
        lines.push(`(truncated at ${maxResults} matches)`);
      }
      if (stderr.trim()) {
        lines.push(`Warnings: ${stderr.trim()}`);
      }

      return lines.join('\n');
    }
  };
}

function createRipgrepArgs({
  pattern,
  glob,
  includeHidden,
  caseSensitive
}: {
  pattern: string;
  glob: string[];
  includeHidden: boolean;
  caseSensitive: boolean;
}): string[] {
  const args = ['--json', '--line-number', '--column', '--color', 'never', '--no-messages'];
  if (includeHidden) {
    args.push('--hidden');
  }
  if (!caseSensitive) {
    args.push('-i');
  }
  for (const includePattern of glob) {
    args.push('-g', includePattern);
  }
  args.push(pattern, '.');
  return args;
}

function runRipgrep(args: string[], cwd: string, signal?: AbortSignal): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('rg', args, { cwd, signal, maxBuffer: MAX_BUFFER_BYTES }, (error, stdout, stderr) => {
      if (isAbortError(error, signal)) {
        reject(new Error(cancellationReason(signal)));
        return;
      }

      const code = typeof error?.code === 'number' ? error.code : 0;
      if (code === 1) {
        resolve({ stdout, stderr });
        return;
      }

      if (error) {
        const message = stderr.trim() || error.message || `rg failed with code ${String(error.code ?? 'unknown')}`;
        reject(new Error(message));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function parseRipgrepMatches(stdout: string, sandbox: PathSandbox, cwd: string): { matches: GrepMatch[] } {
  const matches: GrepMatch[] = [];

  for (const line of stdout.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    let message: RipgrepJsonMessage;
    try {
      message = JSON.parse(line) as RipgrepJsonMessage;
    } catch {
      continue;
    }

    if (message.type !== 'match' || !message.data) {
      continue;
    }

    const pathValue = decodeJsonDataValue(message.data.path);
    const lineValue = decodeJsonDataValue(message.data.lines).replace(/\r?\n$/, '');
    const lineNumber = typeof message.data.line_number === 'number' ? message.data.line_number : 0;
    const submatches = Array.isArray(message.data.submatches) ? message.data.submatches : [];
    const absolutePath = path.resolve(cwd, pathValue);
    const workspacePath = toWorkspaceRelativePath(sandbox, absolutePath);
    if (!workspacePath) {
      continue;
    }

    if (submatches.length === 0) {
      matches.push({
        path: workspacePath,
        line: lineNumber,
        column: 1,
        snippet: limitSnippet(lineValue)
      });
      continue;
    }

    for (const submatch of submatches) {
      const start = typeof submatch.start === 'number' ? submatch.start : 0;
      const matched = decodeJsonDataValue(submatch.match);
      const snippet = matched.trim() ? `${limitSnippet(lineValue)} (match: ${limitSnippet(matched, 80)})` : limitSnippet(lineValue);

      matches.push({
        path: workspacePath,
        line: lineNumber,
        column: start + 1,
        snippet
      });
    }
  }

  return { matches };
}

function decodeJsonDataValue(value: JsonDataValue | undefined): string {
  if (!value) {
    return '';
  }
  if (typeof value.text === 'string') {
    return value.text;
  }
  if (typeof value.bytes === 'string') {
    try {
      return Buffer.from(value.bytes, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
  return '';
}

function limitSnippet(value: string, maxChars = 200): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxChars) {
    return collapsed;
  }
  return `${collapsed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

function countDistinctFiles(matches: GrepMatch[]): number {
  return new Set(matches.map((match) => match.path)).size;
}

function isAbortError(error: ExecFileException | null, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }

  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function cancellationReason(signal?: AbortSignal): string {
  const reason = signal?.reason;
  if (typeof reason === 'string' && reason.trim()) {
    return reason;
  }

  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return 'Run cancelled by user';
}
