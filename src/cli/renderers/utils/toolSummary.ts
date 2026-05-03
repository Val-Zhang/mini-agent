import type { ToolCall } from '../../../types.js';
import { TodoTracker } from './todoTracker.js';

export function formatToolSummary(toolCall: ToolCall, todoTracker: TodoTracker): string {
  const todoSummary = todoTracker.summarizeStart(toolCall);
  if (todoSummary) {
    return todoSummary;
  }

  switch (toolCall.name) {
    case 'read_file':
      return `read_file      ${stringValue(toolCall.input.path)}${formatLimit(toolCall.input.limit)}`;

    case 'write_file':
      return `write_file     ${stringValue(toolCall.input.path)}`;

    case 'edit_file':
      return `edit_file      ${stringValue(toolCall.input.path)}`;

    case 'bash':
      return `bash           ${stringValue(toolCall.input.command)}`;

    case 'task':
      return `task ${formatSubagent(toolCall.input.subagent)} ${stringValue(toolCall.input.description)}`;

    default:
      return `${toolCall.name} ${JSON.stringify(toolCall.input)}`;
  }
}

function formatSubagent(value: unknown): string {
  return typeof value === 'string' && value ? `[${value}]` : '[general]';
}

function formatLimit(value: unknown): string {
  if (typeof value === 'number') {
    return ` (${value} lines)`;
  }

  return '';
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
