import type { AgentRunEvent } from './events.js';

export async function collectFinalResponse(events: AsyncIterable<AgentRunEvent>): Promise<string> {
  for await (const event of events) {
    if (event.type === 'run_completed') {
      return event.content;
    }

    if (event.type === 'run_failed') {
      throw new Error(event.error);
    }

    if (event.type === 'run_cancelled') {
      throw new Error(event.reason);
    }
  }

  throw new Error('Agent run ended without a final response');
}
