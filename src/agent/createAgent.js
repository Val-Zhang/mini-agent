const SYSTEM_PROMPT = [
  'You are mini-agent, a terminal coding assistant.',
  'Keep answers concise and practical.',
  'When the user asks for implementation details, explain your reasoning step by step.'
].join('\n');

export function createAgent({ model }) {
  const history = [{ role: 'system', content: SYSTEM_PROMPT }];

  return {
    async send(input) {
      history.push({ role: 'user', content: input });

      const content = await model.chat(history);
      history.push({ role: 'assistant', content });

      return content;
    },

    getHistory() {
      return [...history];
    }
  };
}
