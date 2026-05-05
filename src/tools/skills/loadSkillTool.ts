import { readFile } from 'node:fs/promises';

import type { SkillConfig, SkillReference } from '../../agent/skills/types.js';
import type { SkillRegistry } from '../../agent/skills/SkillRegistry.js';
import type { ToolDefinition } from '../core/types.js';
import { createLoadSkillSchema } from './schema.js';

const DEFAULT_MAX_CHARS = 12000;

interface LoadSkillInput extends Record<string, unknown> {
  action?: string;
  name?: string;
  reference?: string;
  max_chars?: number;
}

export function createLoadSkillTool({ skills }: { skills: SkillRegistry }): ToolDefinition<LoadSkillInput> {
  return {
    name: 'load_skill',
    schema: createLoadSkillSchema(skills.summaries()),
    async execute(input: LoadSkillInput): Promise<string> {
      const action = readAction(input.action);
      if (action === 'list') {
        return renderSkillList(skills);
      }

      const name = readSkillName(input.name);
      const config = skills.get(name);
      if (!config) {
        const available = skills.availableNames();
        return `Error: unknown skill ${name}. Available skills: ${available.length > 0 ? available.join(', ') : '(none)'}`;
      }

      if (action === 'list_references') {
        return renderReferenceList(config);
      }

      if (action === 'list_scripts') {
        return renderScriptList(config);
      }

      const maxChars = readMaxChars(input.max_chars);
      if (action === 'load_reference') {
        const referencePath = readReferencePath(input.reference);
        const reference = findReference(config, referencePath);
        if (!reference) {
          const available = config.references.map((item) => item.path);
          return `Error: unknown reference ${referencePath} for skill ${config.name}. Available references: ${available.length > 0 ? available.join(', ') : '(none)'}`;
        }

        return loadReferenceContent({ config, reference, maxChars });
      }

      const prompt = clip(config.prompt, maxChars);
      const lines = [
        `Skill: ${config.name}`,
        `Description: ${config.description}`,
        config.whenToUse ? `When to use: ${config.whenToUse}` : null,
        `Source: ${config.sourcePath}`,
        `References: ${config.references.length}`,
        `Scripts: ${config.scripts.length}`,
        '',
        'Instructions:',
        prompt
      ].filter((line): line is string => line !== null);
      if (config.prompt.length > maxChars) {
        lines.push(`(truncated at ${maxChars} chars)`);
      }

      return lines.join('\n');
    }
  };
}

function renderSkillList(skills: SkillRegistry): string {
  const summaries = skills.summaries();
  if (summaries.length === 0) {
    return 'No skills available.';
  }

  const lines = [
    `Available skills (${summaries.length}):`,
    ...summaries.map((skill) =>
      skill.whenToUse
        ? `- ${skill.name}: ${skill.description} | when_to_use: ${skill.whenToUse} | references: ${skill.referenceCount} | scripts: ${skill.scriptCount}`
        : `- ${skill.name}: ${skill.description} | references: ${skill.referenceCount} | scripts: ${skill.scriptCount}`
    )
  ];
  return lines.join('\n');
}

function renderReferenceList(config: SkillConfig): string {
  if (config.references.length === 0) {
    return `No references found for skill ${config.name}.`;
  }

  const lines = [
    `References for ${config.name} (${config.references.length}):`,
    ...config.references.map((reference) => `- ${reference.path} (${reference.sourcePath})`)
  ];
  return lines.join('\n');
}

async function loadReferenceContent({
  config,
  reference,
  maxChars
}: {
  config: SkillConfig;
  reference: SkillReference;
  maxChars: number;
}): Promise<string> {
  const content = await readFile(reference.filePath, 'utf8');
  const clipped = clip(content.trim(), maxChars);
  const lines = [
    `Skill: ${config.name}`,
    `Reference: ${reference.path}`,
    `Source: ${reference.sourcePath}`,
    '',
    'Content:',
    clipped
  ];
  if (content.trim().length > maxChars) {
    lines.push(`(truncated at ${maxChars} chars)`);
  }

  return lines.join('\n');
}

function readAction(value: unknown): 'list' | 'load' | 'list_references' | 'load_reference' | 'list_scripts' {
  if (
    value === 'list' ||
    value === 'load' ||
    value === 'list_references' ||
    value === 'load_reference' ||
    value === 'list_scripts'
  ) {
    return value;
  }

  throw new Error('action must be one of: list, load, list_references, load_reference, list_scripts');
}

function readSkillName(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('name is required for this action');
  }

  return value.trim();
}

function readReferencePath(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('reference is required when action is load_reference');
  }

  return value.trim();
}

function readMaxChars(value: unknown): number {
  if (value === undefined || value === null) {
    return DEFAULT_MAX_CHARS;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('max_chars must be an integer');
  }

  if (value < 500 || value > 50000) {
    throw new Error('max_chars must be between 500 and 50000');
  }

  return value;
}

function clip(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

function findReference(config: SkillConfig, referencePath: string): SkillReference | undefined {
  return config.references.find((reference) => reference.path === referencePath);
}

function renderScriptList(config: SkillConfig): string {
  if (config.scripts.length === 0) {
    return `No executable scripts found for skill ${config.name}.`;
  }

  const lines = [
    `Scripts for ${config.name} (${config.scripts.length}):`,
    ...config.scripts.map((script) => `- ${script.path} (${script.sourcePath})`)
  ];
  return lines.join('\n');
}
