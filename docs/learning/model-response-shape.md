# Model Response Shape

`ModelResponse` 是 mini-agent 内部使用的 provider-neutral 响应结构。它不是某个厂商的官方标准，而是我们为了让 agent runner 不绑定具体模型 API 而定义的内部协议。

## 当前结构

```js
{
  content: string,
  toolCalls: array,
  stopReason: string | null,
  raw: object
}
```

## 来源

这个结构参考 OpenAI-compatible Chat Completions 响应，但没有照搬原始格式。

OpenAI-compatible 原始响应大致是：

```js
{
  choices: [
    {
      message: {
        role: 'assistant',
        content: '...',
        tool_calls: []
      },
      finish_reason: 'stop'
    }
  ],
  usage: {},
  id: '...',
  model: '...'
}
```

我们在 provider adapter 中把它压平成：

```js
{
  content,
  toolCalls,
  stopReason,
  raw
}
```

字段映射：

| 内部字段 | OpenAI-compatible 来源 |
| --- | --- |
| `content` | `choices[0].message.content` |
| `toolCalls` | `choices[0].message.tool_calls` |
| `stopReason` | `choices[0].finish_reason` |
| `raw` | 原始完整响应 |

## 为什么需要内部结构

### 1. AgentRunner 不应该知道 provider 细节

`AgentRunner` 只关心三件事：

- 模型说了什么：`content`
- 模型是否请求工具：`toolCalls`
- 这轮为什么停止：`stopReason`

它不应该知道 DeepSeek、OpenAI、Anthropic、Gemini 或本地模型分别如何组织响应 JSON。

### 2. 支持未来多 provider

不同模型服务的原始协议会不同：

- OpenAI-compatible 使用 `choices[0].message.tool_calls`
- Anthropic Messages API 使用 content blocks
- Gemini 有自己的 candidate / part 结构
- OpenAI Responses API 又是另一套 item/event 结构

Provider adapter 的职责是把这些原始结构转成同一个 `ModelResponse`，让 agent loop 保持稳定。

### 3. 保留 raw 方便调试

内部逻辑使用统一字段，但 `raw` 保留完整原始响应。这样排查模型兼容性、token usage、finish reason 或供应商特殊字段时，不会丢信息。

## Tool Call 子结构

后续应把 `toolCalls` 里的元素也正式定义为内部协议：

```js
{
  id: string,
  name: string,
  input: object
}
```

OpenAI-compatible 映射：

| 内部字段 | OpenAI-compatible 来源 |
| --- | --- |
| `id` | `tool_calls[n].id` |
| `name` | `tool_calls[n].function.name` |
| `input` | `JSON.parse(tool_calls[n].function.arguments)` |

## 当前设计结论

`ModelResponse` 是我们的第一份内部 harness 协议。它的存在让代码分层更清楚：

- provider 负责协议适配。
- runner 负责 agent loop。
- tool layer 负责真实执行。
- CLI 负责输入输出。

后续演进方向：

- 把 `ModelResponse` 和 `ToolCall` 写成明确类型或 JSDoc typedef。
- 增加 `usage` 字段用于 token 统计。
- 增加 `providerMetadata` 或继续依赖 `raw`。
- 为 streaming 增加增量事件结构，但最终 turn 仍归并成 `ModelResponse`。
