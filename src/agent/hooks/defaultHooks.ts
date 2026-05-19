import { HookRegistry } from './HookRegistry.js';
import { createAuditHook } from './auditHook.js';

export function createDefaultHookRegistry(workspaceRoot: string): HookRegistry {
  return new HookRegistry([createAuditHook(workspaceRoot)]);
}
