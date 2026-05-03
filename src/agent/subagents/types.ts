export interface SubagentConfig {
  name: string;
  description: string;
  tools: string[];
  maxTurns: number;
  prompt: string;
}

export interface SubagentSummary {
  name: string;
  description: string;
}
