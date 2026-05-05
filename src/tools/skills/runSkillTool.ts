import { spawn } from 'node:child_process';
import { relative, sep } from 'node:path';

import type { SkillConfig, SkillScript } from '../../agent/skills/types.js';
import type { SkillRegistry } from '../../agent/skills/SkillRegistry.js';
import type { ToolDefinition } from '../core/types.js';
import { createRunSkillSchema } from './runSchema.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 200_000;
const MAX_ARG_COUNT = 64;
const MAX_ARG_LENGTH = 2_000;

interface RunSkillInput extends Record<string, unknown> {
  name?: string;
  script?: string;
  args?: unknown[];
  timeout_ms?: number;
}

interface ScriptExecutionResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  durationMs: number;
}

export function createRunSkillTool({ skills }: { skills: SkillRegistry }): ToolDefinition<RunSkillInput> {
  return {
    name: 'run_skill',
    schema: createRunSkillSchema(skills.summaries()),
    async execute(input, context): Promise<string> {
      const name = readSkillName(input.name);
      const config = skills.get(name);
      if (!config) {
        const available = skills.availableNames();
        return `Error: unknown skill ${name}. Available skills: ${available.length > 0 ? available.join(', ') : '(none)'}`;
      }

      const scriptPath = readScriptPath(input.script);
      const script = config.scripts.find((item) => item.path === scriptPath);
      if (!script) {
        const available = config.scripts.map((item) => item.path);
        return `Error: unknown script ${scriptPath} for skill ${config.name}. Available scripts: ${available.length > 0 ? available.join(', ') : '(none)'}`;
      }

      ensureScriptWithinSkillRoot(config, script);
      const args = readArgs(input.args);
      const timeoutMs = readTimeoutMs(input.timeout_ms);
      const result = await runNodeScript({
        script,
        cwd: config.rootPath,
        args,
        timeoutMs,
        signal: context?.signal
      });

      return formatScriptExecutionResult({ skillName: config.name, scriptPath: script.path, result });
    }
  };
}

async function runNodeScript({
  script,
  cwd,
  args,
  timeoutMs,
  signal
}: {
  script: SkillScript;
  cwd: string;
  args: string[];
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<ScriptExecutionResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(`Script timed out after ${timeoutMs}ms`);
  }, timeoutMs);

  const forwardAbort = () => controller.abort(cancellationReason(signal));
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new Error(cancellationReason(signal));
    }

    signal.addEventListener('abort', forwardAbort);
  }

  let stdout = '';
  let stderr = '';
  let stdoutTruncated = false;
  let stderrTruncated = false;
  let spawnError: Error | null = null;

  try {
    const child = spawn(process.execPath, [script.filePath, ...args], {
      cwd,
      shell: false,
      windowsHide: true,
      signal: controller.signal
    });

    child.stdout?.on('data', (chunk: Buffer | string) => {
      const next = appendOutput(stdout, chunk, MAX_OUTPUT_BYTES);
      stdout = next.content;
      stdoutTruncated = stdoutTruncated || next.truncated;
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      const next = appendOutput(stderr, chunk, MAX_OUTPUT_BYTES);
      stderr = next.content;
      stderrTruncated = stderrTruncated || next.truncated;
    });

    const { exitCode, exitSignal } = await new Promise<{
      exitCode: number | null;
      exitSignal: NodeJS.Signals | null;
    }>((resolve) => {
      child.once('error', (error) => {
        spawnError = error instanceof Error ? error : new Error(String(error));
      });
      child.once('close', (code, exitSignal) => {
        resolve({ exitCode: code, exitSignal });
      });
    });

    if (spawnError) {
      const error = spawnError;
      if (isAbortError(error)) {
        if (timedOut) {
          throw new Error(`Script timed out after ${timeoutMs}ms`);
        }

        throw new Error(cancellationReason(signal));
      }

      throw new Error(`Failed to run script: ${String(error)}`);
    }

    if (timedOut) {
      throw new Error(`Script timed out after ${timeoutMs}ms`);
    }

    return {
      exitCode,
      signal: exitSignal,
      stdout: stdout.trimEnd(),
      stderr: stderr.trimEnd(),
      stdoutTruncated,
      stderrTruncated,
      durationMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', forwardAbort);
    }
  }
}

function appendOutput(
  existing: string,
  chunk: Buffer | string,
  maxBytes: number
): { content: string; truncated: boolean } {
  const nextChunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  const existingBytes = Buffer.byteLength(existing, 'utf8');
  const remaining = maxBytes - existingBytes;
  if (remaining <= 0) {
    return { content: existing, truncated: true };
  }

  if (nextChunkBuffer.byteLength <= remaining) {
    return { content: existing + nextChunkBuffer.toString('utf8'), truncated: false };
  }

  return {
    content: existing + nextChunkBuffer.subarray(0, remaining).toString('utf8'),
    truncated: true
  };
}

function formatScriptExecutionResult({
  skillName,
  scriptPath,
  result
}: {
  skillName: string;
  scriptPath: string;
  result: ScriptExecutionResult;
}): string {
  const lines = [
    `Skill: ${skillName}`,
    `Script: ${scriptPath}`,
    'Runtime: node',
    `Duration: ${result.durationMs}ms`,
    `exit_code: ${result.exitCode ?? 'null'}`,
    `signal: ${result.signal ?? 'null'}`
  ];

  if (result.stdout) {
    lines.push(`stdout:\n${result.stdout}`);
  }

  if (result.stderr) {
    lines.push(`stderr:\n${result.stderr}`);
  }

  if (result.stdoutTruncated || result.stderrTruncated) {
    lines.push(`(output truncated at ${MAX_OUTPUT_BYTES} bytes per stream)`);
  }

  return lines.join('\n');
}

function readSkillName(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('name must be a non-empty string');
  }

  return value.trim();
}

function readScriptPath(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('script must be a non-empty string');
  }

  const normalized = value.trim().replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    throw new Error('script must be a relative path');
  }

  if (normalized.split('/').some((segment) => segment === '..')) {
    throw new Error('script path cannot include ".."');
  }

  return normalized;
}

function readArgs(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('args must be an array of strings');
  }

  if (value.length > MAX_ARG_COUNT) {
    throw new Error(`args must have at most ${MAX_ARG_COUNT} items`);
  }

  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`args[${index}] must be a string`);
    }

    if (item.length > MAX_ARG_LENGTH) {
      throw new Error(`args[${index}] must be ${MAX_ARG_LENGTH} characters or fewer`);
    }

    return item;
  });
}

function readTimeoutMs(value: unknown): number {
  if (value === undefined || value === null) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('timeout_ms must be an integer');
  }

  if (value < 1000 || value > 120000) {
    throw new Error('timeout_ms must be between 1000 and 120000');
  }

  return value;
}

function ensureScriptWithinSkillRoot(config: SkillConfig, script: SkillScript): void {
  const relativePath = relative(config.rootPath, script.filePath);
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..') {
    throw new Error(`script path escapes skill directory: ${script.path}`);
  }
}

function isAbortError(error: Error): boolean {
  return error.name === 'AbortError' || (error as { code?: string }).code === 'ABORT_ERR';
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
