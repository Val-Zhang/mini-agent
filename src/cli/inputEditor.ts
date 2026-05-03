import readline from 'node:readline';
import readlinePromises from 'node:readline/promises';
import type { ReadStream, WriteStream } from 'node:tty';

import {
  BRACKETED_PASTE_END,
  BRACKETED_PASTE_START,
  isModifiedEnterSequence
} from './utils/keys.js';
import { wrappedRowCount } from './utils/displayWidth.js';

const PROMPT = 'you> ';
const CONTINUATION_PROMPT = '... ';

export async function readUserMessage({
  input,
  output
}: {
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
}): Promise<string | null> {
  if (!input.isTTY || !output.isTTY) {
    return readLineFallback({ input, output });
  }

  return readInteractiveMessage({
    input: input as ReadStream,
    output: output as WriteStream
  });
}

async function readLineFallback({
  input,
  output
}: {
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
}): Promise<string | null> {
  const rl = readlinePromises.createInterface({ input, output });

  try {
    return await rl.question(PROMPT);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_USE_AFTER_CLOSE') {
      return null;
    }

    throw error;
  } finally {
    rl.close();
  }
}

function readInteractiveMessage({
  input,
  output
}: {
  input: ReadStream;
  output: WriteStream;
}): Promise<string | null> {
  return new Promise((resolve) => {
    let buffer = '';
    let renderedRowCount = 0;
    let isPasting = false;
    const previousRawMode = input.isRaw;

    const render = () => {
      renderedRowCount = renderInput({ output, buffer, previousRowCount: renderedRowCount });
    };

    const finish = (value: string | null) => {
      input.off('data', onData);
      output.write('\u001b[?2004l');
      input.setRawMode(previousRawMode);
      output.write('\n');
      resolve(value);
    };

    const onData = (chunk: Buffer) => {
      let value = chunk.toString('utf8');

      while (value.length > 0) {
        if (value.startsWith(BRACKETED_PASTE_START)) {
          isPasting = true;
          value = value.slice(BRACKETED_PASTE_START.length);
          continue;
        }

        if (value.startsWith(BRACKETED_PASTE_END)) {
          isPasting = false;
          value = value.slice(BRACKETED_PASTE_END.length);
          render();
          continue;
        }

        if (isPasting) {
          const pasteEndIndex = value.indexOf(BRACKETED_PASTE_END);
          const pasted = pasteEndIndex === -1 ? value : value.slice(0, pasteEndIndex);
          buffer += pasted;
          value = pasteEndIndex === -1 ? '' : value.slice(pasteEndIndex);
          continue;
        }

        const sequence = readNextSequence(value);
        value = value.slice(sequence.length);

        if (sequence === '\u0003') {
          finish(null);
          return;
        }

        if (sequence === '\u0004' && buffer.length === 0) {
          finish(null);
          return;
        }

        if (sequence === '\u0015') {
          buffer = '';
          render();
          continue;
        }

        if (isModifiedEnterSequence(sequence)) {
          buffer += '\n';
          render();
          continue;
        }

        if (sequence === '\r' || sequence === '\n') {
          finish(buffer);
          return;
        }

        if (sequence === '\u007f' || sequence === '\b') {
          buffer = buffer.slice(0, -1);
          render();
          continue;
        }

        if (isPrintableSequence(sequence)) {
          buffer += sequence;
          render();
        }
      }
    };

    input.setRawMode(true);
    output.write('\u001b[?2004h');
    input.resume();
    input.on('data', onData);
    render();
  });
}

function readNextSequence(value: string): string {
  for (const sequence of [BRACKETED_PASTE_START, BRACKETED_PASTE_END]) {
    if (value.startsWith(sequence)) {
      return sequence;
    }
  }

  if (value.startsWith('\u001b[')) {
    const match = value.match(/^\u001b\[[0-9;]*[~u]/);
    if (match) {
      return match[0];
    }
  }

  if (value.startsWith('\u001b') && value.length >= 2) {
    return value.slice(0, 2);
  }

  return Array.from(value)[0] ?? '';
}

function isPrintableSequence(value: string): boolean {
  if (!value) {
    return false;
  }

  if (value.startsWith('\u001b')) {
    return false;
  }

  return ![...value].some((char) => {
    const codePoint = char.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 0x7f;
  });
}

function renderInput({
  output,
  buffer,
  previousRowCount
}: {
  output: WriteStream;
  buffer: string;
  previousRowCount: number;
}): number {
  clearPreviousRender(output, previousRowCount);

  const lines = buffer.split('\n');
  const rendered = lines
    .map((line, index) => `${index === 0 ? PROMPT : CONTINUATION_PROMPT}${line}`)
    .join('\n');

  output.write(rendered);

  return countRenderedRows(lines, output.columns ?? 80);
}

function clearPreviousRender(output: WriteStream, previousRowCount: number): void {
  if (previousRowCount === 0) {
    return;
  }

  readline.cursorTo(output, 0);

  if (previousRowCount > 1) {
    readline.moveCursor(output, 0, -(previousRowCount - 1));
  }

  for (let index = 0; index < previousRowCount; index += 1) {
    readline.clearLine(output, 0);

    if (index < previousRowCount - 1) {
      readline.moveCursor(output, 0, 1);
    }
  }

  if (previousRowCount > 1) {
    readline.moveCursor(output, 0, -(previousRowCount - 1));
  }

  readline.cursorTo(output, 0);
}

function countRenderedRows(lines: string[], columns: number): number {
  return lines.reduce((total, line, index) => {
    const prompt = index === 0 ? PROMPT : CONTINUATION_PROMPT;
    return total + wrappedRowCount(`${prompt}${line}`, columns);
  }, 0);
}
