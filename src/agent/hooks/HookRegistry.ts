import type {
  AgentHook,
  PostToolUseHookContext,
  PreToolUseHookContext,
  PreToolUseHookResult,
  SessionEndHookContext,
  SessionHookContext
} from './types.js';

export interface HookBlock {
  hookName: string;
  reason: string;
}

export class HookRegistry {
  constructor(private readonly hooks: AgentHook[] = []) {}

  list(): AgentHook[] {
    return [...this.hooks];
  }

  async sessionStart(context: SessionHookContext): Promise<void> {
    await this.runVoidHook('onSessionStart', context);
  }

  async sessionEnd(context: SessionEndHookContext): Promise<void> {
    await this.runVoidHook('onSessionEnd', context);
  }

  async preToolUse(context: PreToolUseHookContext): Promise<HookBlock | null> {
    for (const hook of this.hooks) {
      if (!hook.onPreToolUse) {
        continue;
      }

      try {
        const result = await hook.onPreToolUse(context);
        if (isBlock(result)) {
          return { hookName: hook.name, reason: result.reason ?? `${hook.name} blocked ${context.toolCall.name}` };
        }
      } catch (error: unknown) {
        const reason = hookErrorMessage(hook.name, error);
        if (hook.failurePolicy === 'block') {
          return { hookName: hook.name, reason };
        }
        console.warn(reason);
      }
    }

    return null;
  }

  async postToolUse(context: PostToolUseHookContext): Promise<void> {
    await this.runVoidHook('onPostToolUse', context);
  }

  private async runVoidHook<TContext>(
    hookName: 'onSessionStart' | 'onSessionEnd' | 'onPostToolUse',
    context: TContext
  ): Promise<void> {
    for (const hook of this.hooks) {
      const handler = hook[hookName] as ((value: TContext) => Promise<void> | void) | undefined;
      if (!handler) {
        continue;
      }

      try {
        await handler(context);
      } catch (error: unknown) {
        const reason = hookErrorMessage(hook.name, error);
        if (hook.failurePolicy === 'block') {
          throw new Error(reason);
        }
        console.warn(reason);
      }
    }
  }
}

function isBlock(result: PreToolUseHookResult | void): result is PreToolUseHookResult {
  return result?.action === 'block';
}

function hookErrorMessage(hookName: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Hook ${hookName} failed: ${message}`;
}
