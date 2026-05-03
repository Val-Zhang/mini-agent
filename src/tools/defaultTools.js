import { createBashTool } from './bashTool.js';
import { createFilesystemTools } from './filesystemTools.js';
import { createPathSandbox } from './pathSandbox.js';

export function createDefaultTools({ workspaceRoot }) {
  const sandbox = createPathSandbox(workspaceRoot);

  return [
    createBashTool({ workspaceRoot: sandbox.root }),
    ...createFilesystemTools({ sandbox })
  ];
}
