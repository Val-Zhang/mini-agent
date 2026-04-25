import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function startTerminal({ agent, config }) {
  const rl = readline.createInterface({ input, output });

  output.write(`mini-agent using ${config.model} at ${config.baseUrl}\n`);
  output.write('Type /exit to quit.\n\n');

  try {
    while (true) {
      const line = await rl.question('you> ');
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
