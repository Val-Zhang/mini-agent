import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { SkillRegistry } from './SkillRegistry.js';
import { parseSkillMarkdownWithFrontmatter } from './frontmatter.js';
import type { SkillConfig, SkillReference, SkillScript } from './types.js';

const SUPPORTED_NODE_SCRIPT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

export async function loadSkillRegistry({
  workspaceRoot,
  directory = 'skills'
}: {
  workspaceRoot: string;
  directory?: string;
}): Promise<SkillRegistry> {
  const directoryPath = join(workspaceRoot, directory);
  const skillDirs = await readSkillDirectories(directoryPath);
  const configs = await Promise.all(
    skillDirs.map(async (dirName) => {
      const skillDirectoryPath = join(directoryPath, dirName);
      const skillFile = join(skillDirectoryPath, 'SKILL.md');
      const content = await readFile(skillFile, 'utf8');
      const references = await discoverSkillReferences({
        skillDirectoryPath,
        sourceBasePath: `${directory}/${dirName}`
      });
      const scripts = await discoverSkillScripts({
        skillDirectoryPath,
        sourceBasePath: `${directory}/${dirName}`
      });
      return parseSkillMarkdown(content, {
        source: `${dirName}/SKILL.md`,
        expectedName: dirName,
        sourcePath: `${directory}/${dirName}/SKILL.md`,
        rootPath: skillDirectoryPath,
        references,
        scripts
      });
    })
  );

  return new SkillRegistry(configs);
}

export function parseSkillMarkdown(
  content: string,
  {
    source = '<inline>',
    expectedName,
    sourcePath = source,
    rootPath = '.',
    references = [],
    scripts = []
  }: {
    source?: string;
    expectedName?: string;
    sourcePath?: string;
    rootPath?: string;
    references?: SkillReference[];
    scripts?: SkillScript[];
  } = {}
): SkillConfig {
  const { attributes, body } = parseSkillMarkdownWithFrontmatter(content);
  const name = requireSkillName(attributes.name, source);
  const description = requireBoundedString(attributes.description, 'description', source, 1024);
  const whenToUse = readOptionalBoundedString(
    attributes.when_to_use ?? attributes.whenToUse,
    'when_to_use',
    source,
    1024
  );

  if (expectedName && expectedName !== name) {
    throw new Error(`Skill ${source} name must match directory "${expectedName}"`);
  }

  if (!body) {
    throw new Error(`Skill ${source} must include instruction body`);
  }

  return {
    name,
    description,
    whenToUse,
    prompt: body,
    sourcePath,
    rootPath,
    references,
    scripts
  };
}

async function readSkillDirectories(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function requireSkillName(value: unknown, source: string): string {
  const name = requireBoundedString(value, 'name', source, 64);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Skill ${source} must define kebab-case name`);
  }

  return name;
}

function requireBoundedString(value: unknown, field: string, source: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Skill ${source} must define string field: ${field}`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`Skill ${source} field ${field} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function readOptionalBoundedString(
  value: unknown,
  field: string,
  source: string,
  maxLength: number
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requireBoundedString(value, field, source, maxLength);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

async function discoverSkillReferences({
  skillDirectoryPath,
  sourceBasePath
}: {
  skillDirectoryPath: string;
  sourceBasePath: string;
}): Promise<SkillReference[]> {
  const references: SkillReference[] = [];

  const rootReferenceFile = join(skillDirectoryPath, 'reference.md');
  const hasRootReference = await isRegularFile(rootReferenceFile);
  if (hasRootReference) {
    references.push({
      path: 'reference.md',
      sourcePath: toPosixPath(`${sourceBasePath}/reference.md`),
      filePath: rootReferenceFile
    });
  }

  const referencesDirectoryPath = join(skillDirectoryPath, 'references');
  const referenceFiles = await readFilesRecursively(referencesDirectoryPath);
  for (const filePath of referenceFiles) {
    const relativeToReferences = toPosixPath(relative(referencesDirectoryPath, filePath));
    references.push({
      path: relativeToReferences,
      sourcePath: toPosixPath(`${sourceBasePath}/references/${relativeToReferences}`),
      filePath
    });
  }

  references.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  return references;
}

async function discoverSkillScripts({
  skillDirectoryPath,
  sourceBasePath
}: {
  skillDirectoryPath: string;
  sourceBasePath: string;
}): Promise<SkillScript[]> {
  const scriptsDirectoryPath = join(skillDirectoryPath, 'scripts');
  const allFiles = await readFilesRecursively(scriptsDirectoryPath);
  const scripts = allFiles
    .map((filePath) => {
      const relativeToScripts = toPosixPath(relative(scriptsDirectoryPath, filePath));
      return {
        path: relativeToScripts,
        sourcePath: toPosixPath(`${sourceBasePath}/scripts/${relativeToScripts}`),
        filePath
      };
    })
    .filter((script) => hasSupportedNodeScriptExtension(script.path));

  scripts.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  return scripts;
}

async function readFilesRecursively(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await readFilesRecursively(entryPath)));
        continue;
      }

      if (entry.isFile()) {
        files.push(entryPath);
      }
    }

    files.sort((left, right) => left.localeCompare(right));
    return files;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function toPosixPath(value: string): string {
  if (sep === '/') {
    return value;
  }

  return value.split(sep).join('/');
}

function hasSupportedNodeScriptExtension(pathValue: string): boolean {
  const lower = pathValue.toLowerCase();
  for (const ext of SUPPORTED_NODE_SCRIPT_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }

  return false;
}
