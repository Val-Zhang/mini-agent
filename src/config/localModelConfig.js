const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_MODEL = 'qwen2.5-coder:7b';
const DEFAULT_API_KEY = 'local';
const DEFAULT_PROVIDER = 'local-openai-compatible';

export function loadLocalModelConfig(env = process.env) {
  return {
    provider: env.MODEL_PROVIDER || DEFAULT_PROVIDER,
    baseUrl: trimTrailingSlash(env.MODEL_BASE_URL || env.LOCAL_MODEL_BASE_URL || DEFAULT_BASE_URL),
    model: env.MODEL_NAME || env.LOCAL_MODEL_NAME || DEFAULT_MODEL,
    apiKey: env.MODEL_API_KEY || env.LOCAL_MODEL_API_KEY || DEFAULT_API_KEY
  };
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}
