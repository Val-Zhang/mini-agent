import type { SkillSummary } from '../../agent/skills/types.js';
import type { ToolSchema } from '../core/types.js';

export function createRunSkillSchema(skills: SkillSummary[]): ToolSchema {
  const skillNames = skills.map((skill) => skill.name);
  const nameProperty: Record<string, unknown> = {
    type: 'string',
    description: 'Skill name.'
  };
  if (skillNames.length > 0) {
    nameProperty.enum = skillNames;
  }

  return {
    name: 'run_skill',
    description: [
      'Run a Node.js script from skills/<skill-name>/scripts.',
      'Use this after load_skill action=list_scripts identifies the script path.',
      'This tool only executes .js/.mjs/.cjs scripts registered for that skill.'
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        name: nameProperty,
        script: {
          type: 'string',
          description: 'Script path from load_skill action=list_scripts output.'
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Command line arguments passed to the script.'
        },
        timeout_ms: {
          type: 'integer',
          minimum: 1000,
          maximum: 120000,
          description: 'Execution timeout in milliseconds. Defaults to 30000.'
        }
      },
      required: ['name', 'script'],
      additionalProperties: false
    }
  };
}
