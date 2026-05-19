import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { AgentHook, PostToolUseHookContext, SessionEndHookContext, SessionHookContext } from './types.js';

export type AuditRecord =
  | {
      type: 'session_start';
      createdAt: string;
      input: string;
      mode: string;
    }
  | {
      type: 'session_end';
      createdAt: string;
      input: string;
      mode: string;
      status: string;
      message?: string;
    }
  | {
      type: 'tool_use';
      createdAt: string;
      toolName: string;
      inputPreview: string;
      permissionDecision: string;
      permissionReason: string;
      durationMs: number;
      isError: boolean;
      outputPreview: string;
    };

const MAX_PREVIEW_CHARS = 500;

export function auditLogPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'memories', 'session', 'audit.jsonl');
}

export function createAuditHook(workspaceRoot: string): AgentHook {
  return {
    name: 'audit-log',
    async onSessionStart(context) {
      await appendAuditRecord(workspaceRoot, sessionStartRecord(context));
    },
    async onSessionEnd(context) {
      await appendAuditRecord(workspaceRoot, sessionEndRecord(context));
    },
    async onPostToolUse(context) {
      await appendAuditRecord(workspaceRoot, toolUseRecord(context));
    }
  };
}

export async function readAuditRecords(workspaceRoot: string): Promise<AuditRecord[]> {
  try {
    const content = await readFile(auditLogPath(workspaceRoot), 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as AuditRecord);
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function appendAuditRecord(workspaceRoot: string, record: AuditRecord): Promise<void> {
  const target = auditLogPath(workspaceRoot);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(record)}\n`, { flag: 'a' });
}

function sessionStartRecord(context: SessionHookContext): AuditRecord {
  return {
    type: 'session_start',
    createdAt: new Date().toISOString(),
    input: context.input,
    mode: context.mode
  };
}

function sessionEndRecord(context: SessionEndHookContext): AuditRecord {
  return {
    type: 'session_end',
    createdAt: new Date().toISOString(),
    input: context.input,
    mode: context.mode,
    status: context.status,
    message: context.message
  };
}

function toolUseRecord(context: PostToolUseHookContext): AuditRecord {
  return {
    type: 'tool_use',
    createdAt: new Date().toISOString(),
    toolName: context.toolCall.name,
    inputPreview: preview(JSON.stringify(context.toolCall.input)),
    permissionDecision: context.permission.decision,
    permissionReason: context.permission.reason,
    durationMs: context.result.event.durationMs,
    isError: context.result.event.isError,
    outputPreview: preview(context.result.event.content)
  };
}

function preview(value: string): string {
  if (value.length <= MAX_PREVIEW_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_PREVIEW_CHARS)}...`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
