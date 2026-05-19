import type { PermissionResult } from './types.js';

const READ_ONLY_PREFIXES = [
  'pwd',
  'ls',
  'cat',
  'sed -n',
  'rg',
  'find',
  'git status',
  'git diff',
  'git log',
  'git show',
  'git branch'
];

const ASK_PREFIXES = ['npm install', 'pnpm install', 'yarn add', 'git add', 'git commit', 'git push', 'mkdir', 'touch', 'cp', 'mv', 'chmod'];
const DENY_PATTERNS = [/\brm\s+-[^&|;]*r[^&|;]*/u, /\bgit\s+reset\s+--hard\b/u, /\bgit\s+checkout\s+--\b/u, /\bsudo\b/u];
const SHELL_OPERATORS = ['&&', ';', '|', '>', '>>'];

export function classifyBashCommand(command: string): PermissionResult {
  const normalized = command.trim().replace(/\s+/gu, ' ');
  if (!normalized) {
    return { decision: 'deny', reason: 'Empty bash command is not allowed.' };
  }

  if (DENY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { decision: 'deny', reason: `Bash command is blocked by a deny rule: ${normalized}` };
  }

  if (/\b(curl|wget)\b.+\|\s*(bash|sh)\b/u.test(normalized)) {
    return { decision: 'deny', reason: 'Piping downloaded content into a shell is blocked.' };
  }

  if (SHELL_OPERATORS.some((operator) => normalized.includes(operator))) {
    return { decision: 'ask', reason: `Bash command uses shell composition or redirection: ${normalized}` };
  }

  if (ASK_PREFIXES.some((prefix) => startsWithCommand(normalized, prefix))) {
    return { decision: 'ask', reason: `Bash command may modify project state: ${normalized}` };
  }

  if (READ_ONLY_PREFIXES.some((prefix) => startsWithCommand(normalized, prefix))) {
    return { decision: 'allow', reason: `Bash command appears read-only: ${normalized}` };
  }

  return { decision: 'ask', reason: `Bash command needs confirmation: ${normalized}` };
}

function startsWithCommand(command: string, prefix: string): boolean {
  return command === prefix || command.startsWith(`${prefix} `);
}
