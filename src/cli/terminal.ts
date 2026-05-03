import readlinePromises from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import type { ModelConfig } from '../config/localModelConfig.js';
import { readUserMessage } from './inputEditor.js';

interface TerminalAgent {
  send(input: string): Promise<string>;
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

    await sendMessage(agent, message);
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

    await sendMessage(agent, message);
    output.write('you> ');
  }

  rl.close();
}

async function sendMessage(agent: TerminalAgent, message: string): Promise<void> {
  try {
    output.write('agent> 发送中...\n');
    const reply = await agent.send(message);
    output.write(`agent> ${reply}\n\n`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    output.write(`error> ${errorMessage}\n\n`);
  }
}
