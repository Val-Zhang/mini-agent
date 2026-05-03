import type { SubagentConfig, SubagentSummary } from './types.js';

export class SubagentRegistry {
  private readonly configs = new Map<string, SubagentConfig>();

  constructor(configs: SubagentConfig[], private readonly defaultName = 'general') {
    for (const config of configs) {
      this.register(config);
    }

    if (!this.configs.has(this.defaultName)) {
      throw new Error(`Default subagent is missing: ${this.defaultName}`);
    }
  }

  get(name: string): SubagentConfig | undefined {
    return this.configs.get(name);
  }

  getDefault(): SubagentConfig {
    const config = this.configs.get(this.defaultName);
    if (!config) {
      throw new Error(`Default subagent is missing: ${this.defaultName}`);
    }

    return config;
  }

  list(): SubagentConfig[] {
    return [...this.configs.values()];
  }

  summaries(): SubagentSummary[] {
    return this.list().map(({ name, description }) => ({ name, description }));
  }

  availableNames(): string[] {
    return this.list().map((config) => config.name);
  }

  private register(config: SubagentConfig): void {
    if (this.configs.has(config.name)) {
      throw new Error(`Duplicate subagent: ${config.name}`);
    }

    this.configs.set(config.name, config);
  }
}
