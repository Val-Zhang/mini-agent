import type { ToolSchema } from '../core/types.js';

export const listDirSchema: ToolSchema = {
  name: 'list_dir',
  description: 'List files and directories under a workspace path with controlled depth.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list, relative to workspace root. Defaults to ".".'
      },
      depth: {
        type: 'integer',
        minimum: 1,
        maximum: 8,
        description: 'Recursion depth. 1 lists direct children only. Defaults to 1.'
      },
      include_hidden: {
        type: 'boolean',
        description: 'Whether to include dotfiles and dot-directories. Defaults to false.'
      },
      max_entries: {
        type: 'integer',
        minimum: 1,
        maximum: 2000,
        description: 'Maximum number of entries returned. Defaults to 200.'
      }
    },
    additionalProperties: false
  }
};

export const globSchema: ToolSchema = {
  name: 'glob',
  description: 'Find files or directories by glob pattern under a workspace path.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern, for example "src/**/*.ts".'
      },
      path: {
        type: 'string',
        description: 'Base directory path to run glob in, relative to workspace root. Defaults to ".".'
      },
      ignore: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns to exclude from matches.'
      },
      include_hidden: {
        type: 'boolean',
        description: 'Whether to include dotfiles and dot-directories. Defaults to false.'
      },
      max_results: {
        type: 'integer',
        minimum: 1,
        maximum: 5000,
        description: 'Maximum number of paths returned. Defaults to 200.'
      }
    },
    required: ['pattern'],
    additionalProperties: false
  }
};

export const grepSchema: ToolSchema = {
  name: 'grep',
  description: 'Search file contents with regex using ripgrep and return structured matches.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regex pattern to search for.'
      },
      path: {
        type: 'string',
        description: 'Directory or file path to search, relative to workspace root. Defaults to ".".'
      },
      glob: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional include globs, passed to ripgrep as repeated -g rules.'
      },
      case_sensitive: {
        type: 'boolean',
        description: 'Whether matching is case-sensitive. Defaults to true.'
      },
      include_hidden: {
        type: 'boolean',
        description: 'Whether to include hidden files. Defaults to false.'
      },
      max_results: {
        type: 'integer',
        minimum: 1,
        maximum: 5000,
        description: 'Maximum number of matches returned. Defaults to 200.'
      }
    },
    required: ['pattern'],
    additionalProperties: false
  }
};
