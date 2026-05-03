import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function startTerminal({ agent, config }) {
  const rl = readline.createInterface({ input, output });

  output.write(`mini-agent using ${config.provider}:${config.model} at ${config.baseUrl}\n`);
  output.write('Type /exit to quit.\n\n');

  try {
    while (true) {
      const line = await questionOrNull(rl, 'you> ');
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
        const reply = await agent.send(message);
        output.write(`agent> ${reply}\n\n`);
      } catch (error) {
        output.write(`error> ${error.message}\n\n`);
      }
    }
  } finally {
    rl.close();
  }
}

async function questionOrNull(rl, prompt) {
  try {
    return await rl.question(prompt);
  } catch (error) {
    if (error.code === 'ERR_USE_AFTER_CLOSE') {
      return null;
    }

    throw error;
  }
}
