import type { PathSandbox } from '../core/pathSandbox.js';
import type { ToolDefinition } from '../core/types.js';
import { createGlobTool } from './globTool.js';
import { createGrepTool } from './grepTool.js';
import { createListDirTool } from './listDirTool.js';
import { createWebFetchTool } from './webFetchTool.js';

export function createDiscoveryTools({ sandbox }: { sandbox: PathSandbox }): ToolDefinition[] {
  return [createListDirTool({ sandbox }), createGlobTool({ sandbox }), createGrepTool({ sandbox }), createWebFetchTool()];
}
