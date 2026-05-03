import { execFile } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 200_000;

interface CommandResult {
  exitCode: number | string;
  stdout: string;
  stderr: string;
}

export async function runBash(command: string, cwd: string, signal?: AbortSignal): Promise<string> {
  const result = await execFileResult('bash', ['-lc', command], {
    cwd,
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: DEFAULT_MAX_OUTPUT_BYTES,
    signal
  });

  return formatResult(result);
}

function execFileResult(
  file: string,
  args: string[],
  options: { cwd: string; timeout: number; maxBuffer: number; signal?: AbortSignal }
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (isAbortError(error, options.signal)) {
        reject(new Error(cancellationReason(options.signal)));
        return;
      }

      if (error?.killed) {
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

function isAbortError(error: ExecFileException | null, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }

  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function cancellationReason(signal?: AbortSignal): string {
  const reason = signal?.reason;
  if (typeof reason === 'string' && reason.trim()) {
    return reason;
  }

  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return 'Command cancelled by user';
}

function formatResult({ exitCode, stdout, stderr }: CommandResult): string {
  const sections = [`exit_code: ${exitCode}`];

  if (stdout) {
    sections.push(`stdout:\n${stdout.trimEnd()}`);
  }

  if (stderr) {
    sections.push(`stderr:\n${stderr.trimEnd()}`);
  }

  return sections.join('\n');
}
