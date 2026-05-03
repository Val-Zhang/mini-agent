# Practice Session: Agent Loop

## Topic

- 日期：2026-04-28
- 参考主题：https://learn.shareai.run/zh/s01/
- 目标：理解 agent loop 的最小正确形状，并在 Node.js 中搭出 runner 边界。

## Mechanism

普通聊天是 `user -> model -> assistant`。Agent loop 多出来的关键环节是：模型可以表达动作意图，harness 负责执行真实工具，再把工具结果写回消息历史，让模型下一轮基于真实观察继续推理。

今天最重要的结论：工具结果不是终端日志，而是下一轮模型输入的一部分。如果只把结果打印给用户，不写回 `messages`，模型并没有真的观察到世界。

## Python Reference Notes

s01 的教学版强调五步：

1. 用户请求进入 `messages`。
2. 带着 `messages`、system prompt、tools 调模型。
3. assistant 响应写回历史。
4. 如果响应包含 tool use，就执行工具。
5. 把 tool result 写回历史并继续下一轮。

教学边界也很重要：第一天不处理 streaming、retry、permission、hook、compact。先把主回路写对。

## Node Mapping

- 模块边界：`AgentRunner` 负责 loop，`ModelClient` 负责模型协议适配，tool handler 负责真实执行。
- 模型 provider / capability 考虑：runner 只依赖 `model.chat(messages, options)` 返回的结构化结果，不关心本地模型还是商业 API。
- 核心数据结构：`messages`、`toolCalls`、`tool result message`、`LoopState`。
- 异步/进程/文件系统考虑：今天只处理 async handler 形状，不启动真实子进程。
- 错误处理策略：未知工具和工具执行失败先作为 tool result 回填，后续 s11 再做完整恢复。

## ModelResponse Note

当前 `ModelClient.chat()` 返回的结构：

```js
{
  content: string,
  toolCalls: array,
  stopReason: string | null,
  raw: object
}
```

这不是厂商官方标准，而是我们自己的 provider-neutral internal shape。它参考 OpenAI-compatible Chat Completions，但在 provider adapter 中压平成 agent runner 更容易消费的形状。

对应关系：

- `content` 来自 `choices[0].message.content`
- `toolCalls` 来自 `choices[0].message.tool_calls`
- `stopReason` 来自 `choices[0].finish_reason`
- `raw` 保留完整原始响应，方便调试和兼容性排查

这个设计的价值是让 `AgentRunner` 不关心 DeepSeek、OpenAI、Anthropic、Gemini 或本地模型的原始 JSON 差异。Runner 只关心模型说了什么、是否要调工具、这轮为什么停止。

## Terminal App Notes

Node terminal agent 应该把 CLI 展示层和 agent loop 分开。CLI 只负责读用户输入、显示最终结果；runner 负责多轮模型调用和状态推进。这样后续做 streaming、trace、日志和权限确认时不会污染核心 loop。

## Experiment

- 命令：`npm test`
- 输入：fake model 返回普通回答、tool call、未知工具三种场景。
- 输出：测试验证普通回答一轮结束；tool call 会写入 `tool` 消息并继续下一轮；未知工具错误也会作为观察结果回填。
- 观察：只要 runner 统一处理结构化 `toolCalls`，后续 provider 可以逐步适配不同模型 API。

## Open Questions

- OpenAI-compatible 的 `role: "tool"` 消息是否足够作为内部消息格式，还是后续需要引入 provider-neutral transcript format。
- tool schema 应该由 tool registry 直接暴露，还是先通过 provider adapter 转换。

## Next Step

- Day 2 实现 tool registry，并把 `bash/read_file/write_file/edit_file` 做成受控工具。
