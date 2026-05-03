import test from 'node:test';
import assert from 'node:assert/strict';
import type readline from 'node:readline';

import {
  isEnterKey,
  isModifiedEnterKey,
  isModifiedEnterSequence,
  isPrintableInput
} from '../src/cli/utils/keys.js';

test('detects plain enter as submit key', () => {
  assert.equal(isEnterKey(key({ name: 'return' })), true);
  assert.equal(isEnterKey(key({ name: 'enter' })), true);
  assert.equal(isModifiedEnterKey(key({ name: 'return' })), false);
});

test('detects modified enter as multiline key when terminal exposes modifiers', () => {
  assert.equal(isModifiedEnterKey(key({ name: 'return', shift: true })), true);
  assert.equal(isModifiedEnterKey(key({ name: 'return', meta: true })), true);
});

test('detects common modified enter escape sequences', () => {
  assert.equal(isModifiedEnterSequence('\u001b[13;2u'), true);
  assert.equal(isModifiedEnterSequence('\u001b[13;9u'), true);
  assert.equal(isModifiedEnterSequence('\r'), false);
});

test('detects printable input', () => {
  assert.equal(isPrintableInput('a', key({ name: 'a' })), true);
  assert.equal(isPrintableInput('a', key({ name: 'a', ctrl: true })), false);
  assert.equal(isPrintableInput('a', key({ name: 'a', meta: true })), false);
});

function key(value: Partial<readline.Key>): readline.Key {
  return value as readline.Key;
}
