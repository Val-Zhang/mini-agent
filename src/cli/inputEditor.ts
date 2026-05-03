import readline from 'node:readline';
import readlinePromises from 'node:readline/promises';
import type { ReadStream, WriteStream } from 'node:tty';

import {
  isEnterKey,
  isModifiedEnterKey,
  isModifiedEnterSequence,
  isPrintableInput
} from './utils/keys.js';

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
    let renderedLineCount = 0;
    const previousRawMode = input.isRaw;

    const render = () => {
      renderedLineCount = renderInput({ output, buffer, previousLineCount: renderedLineCount });
    };

    const finish = (value: string | null) => {
      input.off('keypress', onKeypress);
      input.setRawMode(previousRawMode);
      output.write('\n');
      resolve(value);
    };

    const onKeypress = (value: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        finish(null);
        return;
      }

      if (key.ctrl && key.name === 'd' && buffer.length === 0) {
        finish(null);
        return;
      }

      if (key.ctrl && key.name === 'u') {
        buffer = '';
        render();
        return;
      }

      if (isModifiedEnterKey(key) || isModifiedEnterSequence(key.sequence)) {
        buffer += '\n';
        render();
        return;
      }

      if (isEnterKey(key)) {
        finish(buffer);
        return;
      }

      if (key.name === 'backspace') {
        buffer = buffer.slice(0, -1);
        render();
        return;
      }

      if (isPrintableInput(value, key)) {
        buffer += value;
        render();
      }
    };

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
    render();
  });
}

function renderInput({
  output,
  buffer,
  previousLineCount
}: {
  output: WriteStream;
  buffer: string;
  previousLineCount: number;
}): number {
  clearPreviousRender(output, previousLineCount);

  const lines = buffer.split('\n');
  const rendered = lines
    .map((line, index) => `${index === 0 ? PROMPT : CONTINUATION_PROMPT}${line}`)
    .join('\n');

  output.write(rendered);

  return lines.length;
}

function clearPreviousRender(output: WriteStream, previousLineCount: number): void {
  if (previousLineCount === 0) {
    return;
  }

  readline.cursorTo(output, 0);

  if (previousLineCount > 1) {
    readline.moveCursor(output, 0, -(previousLineCount - 1));
  }

  for (let index = 0; index < previousLineCount; index += 1) {
    readline.clearLine(output, 0);

    if (index < previousLineCount - 1) {
      readline.moveCursor(output, 0, 1);
    }
  }

  if (previousLineCount > 1) {
    readline.moveCursor(output, 0, -(previousLineCount - 1));
  }

  readline.cursorTo(output, 0);
}
