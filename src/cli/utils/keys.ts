import type readline from 'node:readline';

const MODIFIED_ENTER_SEQUENCES = new Set([
  '\u001b\r',
  '\u001b\n',
  '\u001b[13;2u',
  '\u001b[13;4u',
  '\u001b[13;9u',
  '\u001b[13;10u'
]);

export function isEnterKey(key: readline.Key): boolean {
  return key.name === 'return' || key.name === 'enter';
}

export function isModifiedEnterKey(key: readline.Key): boolean {
  return isEnterKey(key) && (Boolean(key.shift) || Boolean(key.meta));
}

export function isModifiedEnterSequence(sequence: string | undefined): boolean {
  return Boolean(sequence && MODIFIED_ENTER_SEQUENCES.has(sequence));
}

export function isPrintableInput(value: string, key: readline.Key): boolean {
  return Boolean(value) && !key.ctrl && !key.meta;
}
