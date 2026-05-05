export interface SkillReference {
  path: string;
  sourcePath: string;
  filePath: string;
}

export interface SkillScript {
  path: string;
  sourcePath: string;
  filePath: string;
}

export interface SkillConfig {
  name: string;
  description: string;
  whenToUse?: string;
  prompt: string;
  sourcePath: string;
  rootPath: string;
  references: SkillReference[];
  scripts: SkillScript[];
}

export interface SkillSummary {
  name: string;
  description: string;
  whenToUse?: string;
  referenceCount: number;
  scriptCount: number;
}
