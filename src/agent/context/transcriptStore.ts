import path from 'node:path';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import type { ChatMessage } from '../../types.js';

export type TranscriptRecord =
  | {
      type: 'message';
      createdAt: string;
      message: ChatMessage;
    }
  | {
      type: 'compact';
      createdAt: string;
      summary: string;
      sourceMessageCount: number;
    };

export function transcriptPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'memories', 'session', 'transcript.jsonl');
}

export function compactMemoryPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'memories', 'session', 'compact.md');
}

export class TranscriptStore {
  constructor(private readonly workspaceRoot: string) {}

  async appendMessage(message: ChatMessage): Promise<void> {
    await this.appendRecord({ type: 'message', createdAt: new Date().toISOString(), message: cloneMessage(message) });
  }

  async appendCompact(summary: string, sourceMessageCount: number): Promise<void> {
    await this.appendRecord({ type: 'compact', createdAt: new Date().toISOString(), summary, sourceMessageCount });
  }

  private async appendRecord(record: TranscriptRecord): Promise<void> {
    const target = transcriptPath(this.workspaceRoot);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(record)}\n`, { flag: 'a' });
  }
}

export async function readTranscriptRecords(workspaceRoot: string): Promise<TranscriptRecord[]> {
  try {
    const content = await readFile(transcriptPath(workspaceRoot), 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as TranscriptRecord);
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function saveCompactSummary(workspaceRoot: string, summary: string): Promise<void> {
  const target = compactMemoryPath(workspaceRoot);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `# Compacted Session Summary\n\n${summary.trim()}\n`, 'utf8');
}

export async function loadCompactSummary(workspaceRoot: string): Promise<string> {
  try {
    const content = await readFile(compactMemoryPath(workspaceRoot), 'utf8');
    return content.replace(/^# Compacted Session Summary\s*/u, '').trim();
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

export async function clearCompactSummary(workspaceRoot: string): Promise<void> {
  await rm(compactMemoryPath(workspaceRoot), { force: true });
}

function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    tool_calls: message.tool_calls?.map((toolCall) => ({
      ...toolCall,
      function: { ...toolCall.function }
    }))
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
