import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

import {
  approvePlan,
  clearPlanSessionState,
  createImplementationPrompt,
  createPlanSessionState,
  loadPlanSessionState,
  planMemoryPath,
  rejectPlan,
  savePlanSessionState,
  summarizePlan,
  updatePlanDraft
} from '../src/cli/planSession.js';

test('plan session transitions from draft to approved', () => {
  const initial = createPlanSessionState();
  const drafted = updatePlanDraft(initial, 'Step 1\nStep 2');
  const approved = approvePlan(drafted);

  assert.equal(initial.status, 'none');
  assert.equal(drafted.status, 'needs_approval');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.planText, 'Step 1\nStep 2');
});

test('createImplementationPrompt requires approved plan', () => {
  const initial = createPlanSessionState();
  const drafted = updatePlanDraft(initial, 'Plan');
  const approved = approvePlan(drafted);

  assert.equal(createImplementationPrompt(initial), null);
  assert.equal(createImplementationPrompt(drafted), null);
  assert.match(createImplementationPrompt(approved) ?? '', /Implement the approved plan below/);
});

test('rejectPlan clears stored plan', () => {
  const approved = approvePlan(updatePlanDraft(createPlanSessionState(), 'Plan'));
  const cleared = rejectPlan(approved);

  assert.equal(cleared.status, 'none');
  assert.equal(cleared.planText, '');
});

test('plan session state persists to memories/session/plan.md', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'mini-agent-plan-session-'));
  try {
    const drafted = updatePlanDraft(createPlanSessionState(), 'Step A\nStep B');
    const approved = approvePlan(drafted);
    await savePlanSessionState(workspace, approved);

    const stored = await readFile(planMemoryPath(workspace), 'utf8');
    assert.match(stored, /# Session Plan/);
    assert.match(stored, /status: approved/);

    const loaded = await loadPlanSessionState(workspace);
    assert.equal(loaded.status, 'approved');
    assert.equal(loaded.planText, 'Step A\nStep B');

    await clearPlanSessionState(workspace);
    const afterClear = await loadPlanSessionState(workspace);
    assert.equal(afterClear.status, 'none');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('summarizePlan returns the first meaningful line', () => {
  const state = updatePlanDraft(
    createPlanSessionState(),
    '\n\nGoal: refactor auth flow\n- step 1\n- step 2'
  );

  assert.equal(summarizePlan(state), 'Goal: refactor auth flow');
});
