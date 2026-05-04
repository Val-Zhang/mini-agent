import path from 'node:path';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import type { PlanStatus } from '../types.js';

export interface PlanSessionState {
  status: PlanStatus;
  planText: string;
}

export function createPlanSessionState(): PlanSessionState {
  return {
    status: 'none',
    planText: ''
  };
}

export function planMemoryPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'memories', 'session', 'plan.md');
}

export function updatePlanDraft(state: PlanSessionState, content: string): PlanSessionState {
  const text = content.trim();
  if (!text) {
    return state;
  }

  return {
    status: 'needs_approval',
    planText: text
  };
}

export function approvePlan(state: PlanSessionState): PlanSessionState {
  if (state.status !== 'needs_approval') {
    return state;
  }

  return {
    ...state,
    status: 'approved'
  };
}

export function rejectPlan(_state: PlanSessionState): PlanSessionState {
  return createPlanSessionState();
}

export function createImplementationPrompt(state: PlanSessionState): string | null {
  if (state.status !== 'approved' || !state.planText.trim()) {
    return null;
  }

  return [
    'Implement the approved plan below.',
    'Follow the plan carefully, adapt only when necessary, and explain deviations briefly.',
    '',
    'Approved plan:',
    state.planText
  ].join('\n');
}

export async function loadPlanSessionState(workspaceRoot: string): Promise<PlanSessionState> {
  try {
    const content = await readFile(planMemoryPath(workspaceRoot), 'utf8');
    return parsePlanMemory(content);
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return createPlanSessionState();
    }

    throw error;
  }
}

export async function savePlanSessionState(
  workspaceRoot: string,
  state: PlanSessionState
): Promise<void> {
  if (state.status === 'none' || !state.planText.trim()) {
    await clearPlanSessionState(workspaceRoot);
    return;
  }

  const target = planMemoryPath(workspaceRoot);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, renderPlanMemory(state), 'utf8');
}

export async function clearPlanSessionState(workspaceRoot: string): Promise<void> {
  try {
    await rm(planMemoryPath(workspaceRoot), { force: true });
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }
}

export function summarizePlan(state: PlanSessionState, maxChars = 120): string | null {
  const line = firstMeaningfulLine(state.planText);
  if (!line) {
    return null;
  }

  if (line.length <= maxChars) {
    return line;
  }

  return `${line.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

function parsePlanMemory(content: string): PlanSessionState {
  const lines = content.split(/\r?\n/);
  const statusLine = lines.find((line) => line.startsWith('status:'));
  const dividerIndex = lines.findIndex((line) => line.trim() === '---');
  const body = dividerIndex >= 0 ? lines.slice(dividerIndex + 1).join('\n').trim() : content.trim();

  const rawStatus = statusLine?.slice('status:'.length).trim() ?? 'none';
  const status = isPlanStatus(rawStatus) ? rawStatus : 'none';
  if (status === 'none' || !body) {
    return createPlanSessionState();
  }

  return {
    status,
    planText: body
  };
}

function renderPlanMemory(state: PlanSessionState): string {
  return [
    '# Session Plan',
    `status: ${state.status}`,
    `updated_at: ${new Date().toISOString()}`,
    '---',
    state.planText.trim(),
    ''
  ].join('\n');
}

function isPlanStatus(value: string): value is PlanStatus {
  return value === 'none' || value === 'needs_approval' || value === 'approved';
}

function firstMeaningfulLine(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
