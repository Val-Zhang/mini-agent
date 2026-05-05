import type { SkillSummary } from '../../agent/skills/types.js';
import type { ToolSchema } from '../core/types.js';

export function createLoadSkillSchema(skills: SkillSummary[]): ToolSchema {
  const skillNames = skills.map((skill) => skill.name);
  const nameProperty: Record<string, unknown> = {
    type: 'string',
    description: 'Skill name. Required for actions other than list.'
  };
  if (skillNames.length > 0) {
    nameProperty.enum = skillNames;
  }

  return {
    name: 'load_skill',
    description: [
      'List available skills, load skill instructions, and load supporting references on demand.',
      'Use this when the task matches a skill description and you need detailed workflow guidance, skill-specific references, or available scripts.',
      formatSkillList(skills)
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'load', 'list_references', 'load_reference', 'list_scripts'],
          description:
            'list: show skills; load: return one skill body; list_references: show reference files for one skill; load_reference: return one reference file body; list_scripts: show executable scripts for one skill.'
        },
        name: nameProperty,
        reference: {
          type: 'string',
          description: 'Reference file path from list_references output. Required when action is load_reference.'
        },
        max_chars: {
          type: 'integer',
          minimum: 500,
          maximum: 50000,
          description: 'Maximum characters returned when action is load or load_reference. Defaults to 12000.'
        }
      },
      required: ['action'],
      additionalProperties: false
    }
  };
}

function formatSkillList(skills: SkillSummary[]): string {
  if (skills.length === 0) {
    return 'Available skills: (none)';
  }

  const lines = skills.map((skill) => {
    if (!skill.whenToUse) {
      return `- ${skill.name}: ${skill.description} | references: ${skill.referenceCount} | scripts: ${skill.scriptCount}`;
    }

    return `- ${skill.name}: ${skill.description} | when_to_use: ${skill.whenToUse} | references: ${skill.referenceCount} | scripts: ${skill.scriptCount}`;
  });
  return ['Available skills:', ...lines].join('\n');
}
