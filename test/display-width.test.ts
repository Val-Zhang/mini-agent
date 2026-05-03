import test from 'node:test';
import assert from 'node:assert/strict';

import { displayWidth, wrappedRowCount } from '../src/cli/utils/displayWidth.js';

test('counts ascii characters as single width', () => {
  assert.equal(displayWidth('hello'), 5);
});

test('counts CJK characters as double width', () => {
  assert.equal(displayWidth('你好'), 4);
  assert.equal(displayWidth('read README 前 5 行'), 19);
});

test('counts wrapped rows based on terminal columns', () => {
  assert.equal(wrappedRowCount('hello', 10), 1);
  assert.equal(wrappedRowCount('hello world', 10), 2);
  assert.equal(wrappedRowCount('你好世界', 6), 2);
});
