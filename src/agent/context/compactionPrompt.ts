import type { ChatMessage } from '../../types.js';

export function buildCompactionPrompt(messages: ChatMessage[], summaryMaxTokens: number): string {
  return [
    'You are compacting an agent session transcript for a coding agent.',
    'Preserve only durable information needed to continue the task. Do not invent facts.',
    `Keep the summary concise. Target at most ${summaryMaxTokens} tokens.`,
    '',
    'Required markdown sections:',
    '## User Goal',
    '## Current State',
    '## Completed Work',
    '## Key Decisions',
    '## Files / Symbols Touched',
    '## Tool Findings',
    '## Open Questions',
    '## Next Steps',
    '',
    'Transcript to compact:',
    serializeMessages(messages)
  ].join('\n');
}

function serializeMessages(messages: ChatMessage[]): string {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message, index) => {
      const label = `${index + 1}. ${message.role}${message.name ? `:${message.name}` : ''}`;
      const toolCalls = message.tool_calls?.length ? `\ntool_calls: ${JSON.stringify(message.tool_calls)}` : '';
      return `${label}\n${message.content}${toolCalls}`;
    })
    .join('\n\n---\n\n');
}
