import path from 'node:path';

import type { PathSandbox } from '../core/pathSandbox.js';

export function readOptionalPath(value: unknown, fallback = '.'): string {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('path must be a non-empty string');
  }

  return value;
}

export function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value;
}

export function readBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'boolean') {
    throw new Error('boolean value expected');
  }

  return value;
}

export function readIntegerInRange({
  value,
  fallback,
  min,
  max,
  fieldName
}: {
  value: unknown;
  fallback: number;
  min: number;
  max: number;
  fieldName: string;
}): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  if (value < min || value > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }

  return value;
}

export function readStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings`);
  }

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new Error(`${fieldName} must be an array of non-empty strings`);
    }

    result.push(item);
  }

  return result;
}

export function toWorkspaceRelativePath(sandbox: PathSandbox, candidatePath: string): string | null {
  const normalizedRoot = path.resolve(sandbox.root);
  const normalizedPath = path.resolve(candidatePath);
  const isInside = normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}${path.sep}`);
  if (!isInside) {
    return null;
  }

  const relative = path.relative(normalizedRoot, normalizedPath);
  if (!relative) {
    return '.';
  }

  return relative.split(path.sep).join('/');
}
