import test from 'node:test';
import assert from 'node:assert/strict';

import { loadLocalModelConfig } from '../src/config/localModelConfig.js';

test('loads defaults for local model config', () => {
  const config = loadLocalModelConfig({});

  assert.equal(config.baseUrl, 'http://localhost:11434/v1');
  assert.equal(config.model, 'qwen2.5-coder:7b');
  assert.equal(config.apiKey, 'local');
});

test('trims trailing slash from base url', () => {
  const config = loadLocalModelConfig({
    LOCAL_MODEL_BASE_URL: 'http://localhost:1234/v1/',
    LOCAL_MODEL_NAME: 'local-model',
    LOCAL_MODEL_API_KEY: 'secret'
  });

  assert.equal(config.baseUrl, 'http://localhost:1234/v1');
  assert.equal(config.model, 'local-model');
  assert.equal(config.apiKey, 'secret');
});
