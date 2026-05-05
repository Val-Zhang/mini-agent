import type { SkillConfig, SkillSummary } from './types.js';

export class SkillRegistry {
  private readonly configs = new Map<string, SkillConfig>();

  constructor(configs: SkillConfig[]) {
    for (const config of configs) {
      this.register(config);
    }
  }

  get(name: string): SkillConfig | undefined {
    return this.configs.get(name);
  }

  list(): SkillConfig[] {
    return [...this.configs.values()];
  }

  summaries(): SkillSummary[] {
    return this.list().map(({ name, description, whenToUse, references, scripts }) => ({
      name,
      description,
      whenToUse,
      referenceCount: references.length,
      scriptCount: scripts.length
    }));
  }

  availableNames(): string[] {
    return this.list().map((config) => config.name);
  }

  private register(config: SkillConfig): void {
    if (this.configs.has(config.name)) {
      throw new Error(`Duplicate skill: ${config.name}`);
    }

    this.configs.set(config.name, config);
  }
}
