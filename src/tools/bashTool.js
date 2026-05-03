import { execFile } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 200_000;

export function createBashTool({ workspaceRoot }) {
  return {
    name: 'bash',
    schema: {
      name: 'bash',
      description: 'Run a bash command in the current workspace and return stdout, stderr, and exit code.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Bash command to run.'
          }
        },
        required: ['command'],
        additionalProperties: false
      }
    },
    async execute(input) {
      if (typeof input.command !== 'string' || input.command.trim() === '') {
        throw new Error('command must be a non-empty string');
      }

      return runBash(input.command, workspaceRoot);
    }
  };
}

async function runBash(command, cwd) {
  const result = await execFileResult('bash', ['-lc', command], {
    cwd,
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: DEFAULT_MAX_OUTPUT_BYTES
  });

  return formatResult(result);
}

function execFileResult(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error && error.killed) {
        reject(new Error(`Command timed out after ${options.timeout}ms`));
        return;
      }

      resolve({
        exitCode: error?.code ?? 0,
        stdout,
        stderr
      });
    });
  });
}

function formatResult({ exitCode, stdout, stderr }) {
  const sections = [`exit_code: ${exitCode}`];

  if (stdout) {
    sections.push(`stdout:\n${stdout.trimEnd()}`);
  }

  if (stderr) {
    sections.push(`stderr:\n${stderr.trimEnd()}`);
  }

  return sections.join('\n');
}
