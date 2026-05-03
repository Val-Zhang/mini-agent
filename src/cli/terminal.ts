import readlinePromises from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import type { ModelConfig } from '../config/localModelConfig.js';
import type { AgentSendOptions } from '../types.js';
import { readUserMessage } from './inputEditor.js';
import { createRenderer } from './renderers/createRenderer.js';

interface TerminalAgent {
  send(input: string, options?: AgentSendOptions): Promise<string>;
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
  const renderer = createRenderer({ output });

  try {
    renderer.renderStart(message);
    const reply = await agent.send(message, { onEvent: (event) => renderer.renderEvent(event) });
    renderer.renderFinal(reply);
  } catch (error: unknown) {
    renderer.renderError(error);
  }
}
