import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadSkillRegistry, parseSkillMarkdown } from '../src/agent/skills/loadSkills.js';
import { createLoadSkillTool } from '../src/tools/skills/loadSkillTool.js';
import { createRunSkillTool } from '../src/tools/skills/runSkillTool.js';

test('parses a markdown skill file', () => {
  const config = parseSkillMarkdown(
    [
      '---',
      'name: architecture-review',
      'description: Review architecture trade-offs',
      'when_to_use: Before committing large refactors',
      '---',
      '',
      'Read the code first.',
      'Write a concise trade-off summary.'
    ].join('\n')
  );

  assert.deepEqual(config, {
    name: 'architecture-review',
    description: 'Review architecture trade-offs',
    whenToUse: 'Before committing large refactors',
    prompt: 'Read the code first.\nWrite a concise trade-off summary.',
    sourcePath: '<inline>',
    rootPath: '.',
    references: [],
    scripts: []
  });
});

test('loads skills from skills/*/SKILL.md', async () => {
  const workspace = await createTempWorkspace();
  try {
    await mkdir(path.join(workspace, 'skills', 'researcher'), { recursive: true });
    await mkdir(path.join(workspace, 'skills', 'reviewer'), { recursive: true });
    await mkdir(path.join(workspace, 'skills', 'researcher', 'references'), { recursive: true });
    await mkdir(path.join(workspace, 'skills', 'researcher', 'scripts'), { recursive: true });

    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'SKILL.md'),
      [
        '---',
        'name: researcher',
        'description: Focused read-only investigation',
        'when_to_use: Need fast evidence before proposing edits',
        '---',
        '',
        'Gather facts before proposing edits.'
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'reference.md'),
      'Root reference details',
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'references', 'api.md'),
      'API reference details',
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'scripts', 'run.mjs'),
      'console.log("script ok");',
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'reviewer', 'SKILL.md'),
      [
        '---',
        'name: reviewer',
        'description: Strict code review workflow',
        'when_to_use: Pre-merge risk review',
        '---',
        '',
        'Prioritize risks and regressions.'
      ].join('\n'),
      'utf8'
    );

    const registry = await loadSkillRegistry({ workspaceRoot: workspace });
    assert.deepEqual(registry.availableNames(), ['researcher', 'reviewer']);
    assert.equal(registry.get('researcher')?.sourcePath, 'skills/researcher/SKILL.md');
    assert.equal(
      registry.get('researcher')?.whenToUse,
      'Need fast evidence before proposing edits'
    );
    assert.deepEqual(
      registry.get('researcher')?.references.map((reference) => reference.sourcePath),
      ['skills/researcher/reference.md', 'skills/researcher/references/api.md']
    );
    assert.deepEqual(
      registry.get('researcher')?.scripts.map((script) => script.sourcePath),
      ['skills/researcher/scripts/run.mjs']
    );
    assert.equal(registry.get('researcher')?.rootPath, path.join(workspace, 'skills', 'researcher'));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('returns an empty registry when no skills directory exists', async () => {
  const workspace = await createTempWorkspace();
  try {
    const registry = await loadSkillRegistry({ workspaceRoot: workspace });
    assert.deepEqual(registry.availableNames(), []);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('load_skill lists and loads skill content', async () => {
  const workspace = await createTempWorkspace();
  try {
    await mkdir(path.join(workspace, 'skills', 'researcher'), { recursive: true });
    await mkdir(path.join(workspace, 'skills', 'researcher', 'references'), { recursive: true });
    await mkdir(path.join(workspace, 'skills', 'researcher', 'scripts'), { recursive: true });
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'SKILL.md'),
      [
        '---',
        'name: researcher',
        'description: Focused read-only investigation',
        'when_to_use: Need fast evidence before proposing edits',
        '---',
        '',
        'Gather facts before proposing edits.'
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'references', 'api.md'),
      'API reference details',
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'scripts', 'run.mjs'),
      'console.log("script ok");',
      'utf8'
    );

    const registry = await loadSkillRegistry({ workspaceRoot: workspace });
    const tool = createLoadSkillTool({ skills: registry });

    const listResult = await tool.execute({ action: 'list' });
    assert.match(listResult, /Available skills \(1\):/);
    assert.match(listResult, /researcher: Focused read-only investigation/);
    assert.match(listResult, /references: 1/);
    assert.match(listResult, /scripts: 1/);
    assert.match(listResult, /when_to_use: Need fast evidence before proposing edits/);

    const loadResult = await tool.execute({ action: 'load', name: 'researcher' });
    assert.match(loadResult, /Skill: researcher/);
    assert.match(loadResult, /When to use: Need fast evidence before proposing edits/);
    assert.match(loadResult, /Source: skills\/researcher\/SKILL\.md/);
    assert.match(loadResult, /References: 1/);
    assert.match(loadResult, /Scripts: 1/);
    assert.match(loadResult, /Gather facts before proposing edits\./);

    const listReferencesResult = await tool.execute({ action: 'list_references', name: 'researcher' });
    assert.match(listReferencesResult, /References for researcher \(1\):/);
    assert.match(listReferencesResult, /api\.md \(skills\/researcher\/references\/api\.md\)/);

    const loadReferenceResult = await tool.execute({
      action: 'load_reference',
      name: 'researcher',
      reference: 'api.md'
    });
    assert.match(loadReferenceResult, /Skill: researcher/);
    assert.match(loadReferenceResult, /Reference: api\.md/);
    assert.match(loadReferenceResult, /Source: skills\/researcher\/references\/api\.md/);
    assert.match(loadReferenceResult, /API reference details/);

    const listScriptsResult = await tool.execute({ action: 'list_scripts', name: 'researcher' });
    assert.match(listScriptsResult, /Scripts for researcher \(1\):/);
    assert.match(listScriptsResult, /run\.mjs \(skills\/researcher\/scripts\/run\.mjs\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('load_skill returns unknown skill errors with available names', async () => {
  const workspace = await createTempWorkspace();
  try {
    const registry = await loadSkillRegistry({ workspaceRoot: workspace });
    const tool = createLoadSkillTool({ skills: registry });

    const result = await tool.execute({ action: 'load', name: 'missing-skill' });
    assert.equal(result, 'Error: unknown skill missing-skill. Available skills: (none)');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('load_skill returns unknown reference errors with available references', async () => {
  const workspace = await createTempWorkspace();
  try {
    await mkdir(path.join(workspace, 'skills', 'researcher', 'references'), { recursive: true });
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'SKILL.md'),
      [
        '---',
        'name: researcher',
        'description: Focused read-only investigation',
        '---',
        '',
        'Gather facts before proposing edits.'
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'references', 'api.md'),
      'API reference details',
      'utf8'
    );

    const registry = await loadSkillRegistry({ workspaceRoot: workspace });
    const tool = createLoadSkillTool({ skills: registry });

    const result = await tool.execute({
      action: 'load_reference',
      name: 'researcher',
      reference: 'missing.md'
    });
    assert.equal(
      result,
      'Error: unknown reference missing.md for skill researcher. Available references: api.md'
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('run_skill executes Node scripts discovered in skill scripts directory', async () => {
  const workspace = await createTempWorkspace();
  try {
    await mkdir(path.join(workspace, 'skills', 'researcher', 'scripts'), { recursive: true });
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'SKILL.md'),
      [
        '---',
        'name: researcher',
        'description: Focused read-only investigation',
        '---',
        '',
        'Gather facts before proposing edits.'
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'scripts', 'run.mjs'),
      'console.log(`hello ${process.argv[2] ?? "world"}`);',
      'utf8'
    );

    const registry = await loadSkillRegistry({ workspaceRoot: workspace });
    const tool = createRunSkillTool({ skills: registry });
    const result = await tool.execute({
      name: 'researcher',
      script: 'run.mjs',
      args: ['agent']
    });

    assert.match(result, /Skill: researcher/);
    assert.match(result, /Script: run\.mjs/);
    assert.match(result, /Runtime: node/);
    assert.match(result, /exit_code: 0/);
    assert.match(result, /stdout:\nhello agent/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('run_skill returns unknown script errors with available scripts', async () => {
  const workspace = await createTempWorkspace();
  try {
    await mkdir(path.join(workspace, 'skills', 'researcher', 'scripts'), { recursive: true });
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'SKILL.md'),
      [
        '---',
        'name: researcher',
        'description: Focused read-only investigation',
        '---',
        '',
        'Gather facts before proposing edits.'
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'skills', 'researcher', 'scripts', 'run.mjs'),
      'console.log("ok");',
      'utf8'
    );

    const registry = await loadSkillRegistry({ workspaceRoot: workspace });
    const tool = createRunSkillTool({ skills: registry });
    const result = await tool.execute({
      name: 'researcher',
      script: 'missing.mjs'
    });

    assert.equal(
      result,
      'Error: unknown script missing.mjs for skill researcher. Available scripts: run.mjs'
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

async function createTempWorkspace(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'mini-agent-skills-'));
}
