import path from 'node:path';

export interface PathSandbox {
  root: string;
  resolvePath(requestedPath: string): string;
}

export function createPathSandbox(workspaceRoot: string): PathSandbox {
  const root = path.resolve(workspaceRoot);

  return {
    root,

    resolvePath(requestedPath) {
      if (typeof requestedPath !== 'string' || requestedPath.trim() === '') {
        throw new Error('path must be a non-empty string');
      }

      const resolved = path.resolve(root, requestedPath);

      if (!isInsideRoot(root, resolved)) {
        throw new Error(`Path escapes workspace: ${requestedPath}`);
      }

      return resolved;
    }
  };
}

function isInsideRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}
