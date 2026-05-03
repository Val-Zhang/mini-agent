# Model Provider Plan

我们的模型调用策略：优先支持本地模型，同时通过统一接口支持不同商业模型 API。

这个计划会贯穿后续 agent loop、tool calling、context compact、error recovery 和 terminal app 配置设计。模型层必须保持可替换，agent runner 不应该知道具体使用的是 Ollama、LM Studio、OpenAI、Anthropic、Gemini，还是其他 OpenAI-compatible 服务。

## 目标

- 本地优先：默认支持 OpenAI-compatible 本地服务，例如 Ollama、LM Studio、llama.cpp server、vLLM。
- API 兼容：支持通过 API key 访问商业模型。
- 接口统一：agent runner 只依赖 `ModelClient`，不直接依赖 provider。
- 能力可发现：不同模型是否支持 tool calling、streaming、vision、reasoning effort 等能力要显式描述。
- 配置清晰：CLI 和环境变量能选择 provider、model、base URL、API key。

## 初始 Provider 设想

### local-openai-compatible

- 用途：本地模型优先路径。
- 协议：OpenAI-compatible Chat Completions。
- 默认地址：`http://localhost:11434/v1`
- 适配对象：Ollama、LM Studio、llama.cpp server、vLLM。

### openai-compatible

- 用途：连接商业或第三方 OpenAI-compatible API。
- 协议：OpenAI-compatible Chat Completions。
- 配置项：`baseUrl`、`apiKey`、`model`。
- 适配对象：OpenAI-compatible 网关、代理服务、部分云厂商。

### future-native-providers

后续如果某些厂商的能力无法通过 OpenAI-compatible 协议表达，再增加 native provider。

候选：

- OpenAI Responses API
- Anthropic Messages API
- Google Gemini API
- DeepSeek API

## 统一接口草案

```js
class ModelClient {
  async chat(messages, options) {
    throw new Error('not implemented');
  }

  capabilities() {
    return {
      streaming: false,
      toolCalling: false,
      jsonMode: false,
      reasoning: false
    };
  }
}
```

后续 agent runner 只使用：

```js
const result = await model.chat(messages, {
  tools,
  temperature,
  signal
});
```

返回值不应只是字符串，应该逐步演进为结构化响应：

```js
{
  content: '...',
  toolCalls: [],
  raw: {}
}
```

## 配置草案

环境变量：

```bash
MODEL_PROVIDER=local-openai-compatible
MODEL_BASE_URL=http://localhost:11434/v1
MODEL_NAME=qwen2.5-coder:7b
MODEL_API_KEY=local
```

兼容旧变量：

```bash
LOCAL_MODEL_BASE_URL
LOCAL_MODEL_NAME
LOCAL_MODEL_API_KEY
```

CLI 后续可支持：

```bash
mini-agent --provider local-openai-compatible --model qwen2.5-coder:7b
mini-agent --provider openai-compatible --base-url https://api.example.com/v1 --model some-model
```

## 实现阶段

### Phase 1: Config Rename + Compatibility

- 新增通用 `loadModelConfig`。
- 保留旧的 `LOCAL_MODEL_*` 兼容读取。
- README 和 `.env.example` 改成 `MODEL_*`。

### Phase 2: Provider Registry

- 新增 `createModelClient(config)`。
- 将当前 `LocalModelClient` 重命名或包装成 `OpenAICompatibleChatClient`。
- agent runner 只接收统一 `model`。

### Phase 3: Structured Response

- `chat()` 返回 `{ content, toolCalls, raw }`。
- 支持无工具模型和工具调用模型的差异。
- 让 Day 1 Agent Loop 不依赖具体 provider 响应形状。

### Phase 4: Streaming

- 支持 streaming 结果。
- CLI 层负责渐进输出。
- agent loop 仍以完整 turn 作为状态提交边界。

### Phase 5: Native Providers

- 按实际需要增加 OpenAI/Anthropic/Gemini 等 native provider。
- 每个 provider 显式声明 capabilities。
- 用 provider-level tests 固定输入输出映射。

## 学习重点

我们不是只要“能调用模型”，而是要理解 terminal agent 中模型层的边界：

- provider 负责协议适配。
- runner 负责 agent loop。
- tool layer 负责真实执行。
- prompt builder 负责系统上下文。
- CLI 负责用户交互和流式显示。
