import readlinePromises from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import type { ModelConfig } from '../config/localModelConfig.js';
import type { AgentRunEvent } from '../types.js';
import { readUserMessage } from './inputEditor.js';
import { createRenderer } from './renderers/createRenderer.js';

interface TerminalAgent {
  run(input: string, options?: { signal?: AbortSignal }): AsyncIterable<AgentRunEvent>;
}

export async function startTerminal({ agent, config }: { agent: TerminalAgent; config: ModelConfig }): Promise<void> {
  output.write(`mini-agent using ${config.provider}:${config.model} at ${config.baseUrl}\n`);
  output.write('Type /exit to quit.\n\n');

  if (!input.isTTY || !output.isTTY) {
    await startLineModeTerminal(agent);
    return;
  }

  while (true) {
    const line = await readUserMessage({ input, output });
    if (line === null) {
      break;
    }

    const message = line.trim();

    if (!message) {
      continue;
    }

    if (message === '/exit' || message === '/quit') {
      break;
    }

    try {
      await sendMessage(agent, message);
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

  output.write('you> ');
  for await (const line of rl) {
    const message = line.trim();

    if (!message) {
      output.write('you> ');
      continue;
    }

    if (message === '/exit' || message === '/quit') {
      break;
    }

    try {
      await sendMessage(agent, message);
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

async function sendMessage(agent: TerminalAgent, message: string): Promise<void> {
  const renderer = createRenderer({ output });
  const controller = new AbortController();
  let exitRequested = false;
  let cancellationRequested = false;

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
    for await (const event of agent.run(message, { signal: controller.signal })) {
      renderer.render(event);
    }
  } finally {
    process.off('SIGINT', onSigint);
  }

  if (exitRequested) {
    throw new Error('TERMINAL_EXIT_REQUESTED');
  }
}

function isTerminalExitRequest(error: unknown): boolean {
  return error instanceof Error && error.message === 'TERMINAL_EXIT_REQUESTED';
}
