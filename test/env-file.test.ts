import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEnvFile } from '../src/config/envFile.js';

test('parses dotenv-style key value pairs', () => {
  const entries = parseEnvFile(`
    # comment
    MODEL_PROVIDER=openai-compatible
    MODEL_NAME="deepseek-v4-flash"
    MODEL_API_KEY='secret'
  `);

  assert.deepEqual(entries, [
    ['MODEL_PROVIDER', 'openai-compatible'],
    ['MODEL_NAME', 'deepseek-v4-flash'],
    ['MODEL_API_KEY', 'secret']
  ]);
});
