import readlinePromises from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import type { ModelConfig } from '../config/localModelConfig.js';
import type { AgentMode, AgentRunEvent } from '../types.js';
import {
  approvePlan,
  clearPlanSessionState,
  createImplementationPrompt,
  loadPlanSessionState,
  rejectPlan,
  savePlanSessionState,
  summarizePlan,
  updatePlanDraft,
  type PlanSessionState
} from './planSession.js';
import { readUserMessage } from './inputEditor.js';
import { createRenderer } from './renderers/createRenderer.js';

interface TerminalAgent {
  run(input: string, options?: { signal?: AbortSignal; mode?: AgentMode }): AsyncIterable<AgentRunEvent>;
}

export async function startTerminal({ agent, config }: { agent: TerminalAgent; config: ModelConfig }): Promise<void> {
  output.write(`mini-agent using ${config.provider}:${config.model} at ${config.baseUrl}\n`);
  output.write('Type /plan, /approve, /reject, /implement, /execute, /mode, /exit.\n\n');

  if (!input.isTTY || !output.isTTY) {
    await startLineModeTerminal(agent);
    return;
  }

  const workspaceRoot = process.cwd();
  let mode: AgentMode = 'execute';
  let planState = await loadPlanSessionState(workspaceRoot);
  while (true) {
    const line = await readUserMessage({ input, output });
    if (line === null) {
      break;
    }

    const message = line.trim();

    if (!message) {
      continue;
    }

    let command: Awaited<ReturnType<typeof executeTerminalCommand>>;
    try {
      command = await executeTerminalCommand({
        agent,
        message,
        mode,
        planState,
        workspaceRoot
      });
    } catch (error: unknown) {
      if (isTerminalExitRequest(error)) {
        break;
      }
      throw error;
    }
    if (command.handled) {
      mode = command.mode;
      planState = command.planState;
      if (command.exitRequested) {
        break;
      }
      continue;
    }

    try {
      const result = await sendMessage(agent, message, mode);
      if (mode === 'plan' && result.completedContent) {
        planState = updatePlanDraft(planState, result.completedContent);
        if (planState.status === 'needs_approval') {
          await savePlanSessionState(workspaceRoot, planState);
          emitTerminalEvent({
            type: 'plan_status_changed',
            status: 'needs_approval',
            message: '计划草案已生成。请使用 /approve 批准，或 /reject 丢弃。'
          });
        }
      }
    } catch (error: unknown) {
      if (isTerminalExitRequest(error)) {
        break;
      }
      throw error;
    }
  }
}

async function startLineModeTerminal(agent: TerminalAgent): Promise<void> {
  const rl = readlinePromises.createInterface({ input, output, terminal: false });
  const workspaceRoot = process.cwd();
  let mode: AgentMode = 'execute';
  let planState = await loadPlanSessionState(workspaceRoot);

  output.write('you> ');
  for await (const line of rl) {
    const message = line.trim();

    if (!message) {
      output.write('you> ');
      continue;
    }

    let command: Awaited<ReturnType<typeof executeTerminalCommand>>;
    try {
      command = await executeTerminalCommand({
        agent,
        message,
        mode,
        planState,
        workspaceRoot
      });
    } catch (error: unknown) {
      if (isTerminalExitRequest(error)) {
        break;
      }
      throw error;
    }
    if (command.handled) {
      mode = command.mode;
      planState = command.planState;
      if (command.exitRequested) {
        break;
      }

      output.write('you> ');
      continue;
    }

    try {
      const result = await sendMessage(agent, message, mode);
      if (mode === 'plan' && result.completedContent) {
        planState = updatePlanDraft(planState, result.completedContent);
        if (planState.status === 'needs_approval') {
          await savePlanSessionState(workspaceRoot, planState);
          emitTerminalEvent({
            type: 'plan_status_changed',
            status: 'needs_approval',
            message: '计划草案已生成。请使用 /approve 批准，或 /reject 丢弃。'
          });
        }
      }
    } catch (error: unknown) {
      if (isTerminalExitRequest(error)) {
        break;
      }
      throw error;
    }
    output.write('you> ');
  }

  rl.close();
}

async function sendMessage(
  agent: TerminalAgent,
  message: string,
  mode: AgentMode
): Promise<{ completedContent: string | null }> {
  const renderer = createRenderer({ output });
  const controller = new AbortController();
  let exitRequested = false;
  let cancellationRequested = false;
  let completedContent: string | null = null;

  const onSigint = () => {
    if (!cancellationRequested) {
      cancellationRequested = true;
      controller.abort('Run cancelled by user');
      output.write('\n^C 正在取消当前任务...\n');
      return;
    }

    exitRequested = true;
    controller.abort('Run cancelled by user');
    output.write('\n^C 准备退出...\n');
  };

  process.on('SIGINT', onSigint);
  try {
    for await (const event of agent.run(message, { signal: controller.signal, mode })) {
      renderer.render(event);
      if (event.type === 'run_completed') {
        completedContent = event.content;
      }
    }
  } finally {
    process.off('SIGINT', onSigint);
  }

  if (exitRequested) {
    throw new Error('TERMINAL_EXIT_REQUESTED');
  }

  return { completedContent };
}

function isTerminalExitRequest(error: unknown): boolean {
  return error instanceof Error && error.message === 'TERMINAL_EXIT_REQUESTED';
}

async function executeTerminalCommand({
  agent,
  message,
  mode,
  planState,
  workspaceRoot
}: {
  agent: TerminalAgent;
  message: string;
  mode: AgentMode;
  planState: PlanSessionState;
  workspaceRoot: string;
}): Promise<{ handled: boolean; mode: AgentMode; planState: PlanSessionState; exitRequested: boolean }> {
  if (message === '/exit' || message === '/quit') {
    return { handled: true, mode, planState, exitRequested: true };
  }

  if (message === '/plan') {
    emitTerminalEvent({ type: 'mode_changed', mode: 'plan' });
    return { handled: true, mode: 'plan', planState, exitRequested: false };
  }

  if (message === '/execute') {
    emitTerminalEvent({ type: 'mode_changed', mode: 'execute' });
    return { handled: true, mode: 'execute', planState, exitRequested: false };
  }

  if (message === '/mode') {
    emitTerminalEvent({ type: 'mode_changed', mode });
    if (planState.status !== 'none') {
      const summary = summarizePlan(planState);
      emitTerminalEvent({
        type: 'plan_status_changed',
        status: planState.status,
        message: summary ? `${describePlanStatus(planState.status)} 摘要：${summary}` : describePlanStatus(planState.status)
      });
    }
    return { handled: true, mode, planState, exitRequested: false };
  }

  if (message === '/approve') {
    if (planState.status !== 'needs_approval') {
      emitTerminalEvent({
        type: 'plan_status_changed',
        status: planState.status,
        message: '当前没有待审批的计划草案。'
      });
      return { handled: true, mode, planState, exitRequested: false };
    }

    const next = approvePlan(planState);
    await savePlanSessionState(workspaceRoot, next);
    emitTerminalEvent({
      type: 'plan_status_changed',
      status: next.status,
      message: '计划已批准。输入 /implement 开始执行。'
    });
    return { handled: true, mode, planState: next, exitRequested: false };
  }

  if (message === '/reject') {
    if (planState.status === 'none') {
      emitTerminalEvent({
        type: 'plan_status_changed',
        status: 'none',
        message: '当前没有可丢弃的计划。'
      });
      return { handled: true, mode, planState, exitRequested: false };
    }

    emitTerminalEvent({
      type: 'plan_status_changed',
      status: 'none',
      message: '已丢弃当前计划。'
    });
    const next = rejectPlan(planState);
    await clearPlanSessionState(workspaceRoot);
    return { handled: true, mode, planState: next, exitRequested: false };
  }

  if (message === '/implement') {
    const prompt = createImplementationPrompt(planState);
    if (!prompt) {
      emitTerminalEvent({
        type: 'plan_status_changed',
        status: planState.status,
        message: '还没有已批准计划。请先在 /plan 模式生成计划并 /approve。'
      });
      return { handled: true, mode, planState, exitRequested: false };
    }

    if (mode !== 'execute') {
      emitTerminalEvent({ type: 'mode_changed', mode: 'execute' });
    }
    emitTerminalEvent({
      type: 'implementation_started',
      message: '开始执行已批准计划。'
    });
    await sendMessage(agent, prompt, 'execute');
    return { handled: true, mode: 'execute', planState, exitRequested: false };
  }

  return { handled: false, mode, planState, exitRequested: false };
}

function emitTerminalEvent(event: AgentRunEvent): void {
  const renderer = createRenderer({ output });
  renderer.render(event);
}

function describePlanStatus(status: PlanSessionState['status']): string {
  if (status === 'needs_approval') {
    return '当前有待审批计划。可使用 /approve 或 /reject。';
  }

  if (status === 'approved') {
    return '当前计划已批准。可使用 /implement 执行。';
  }

  return '当前没有保存的计划。';
}
