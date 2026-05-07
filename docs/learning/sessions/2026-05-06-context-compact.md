# Session: Day 9 Context Compact (2026-05-06)

## 今日目标

系统梳理 agent 上下文压缩机制，并在 mini-agent 中实现一个可观察、可手动控制、可自动触发的最小闭环。

## 关键概念

- **Context Window**：一次模型请求可承载的总 token 预算。对 agent 来说，它由 system prompt、模式提示、工具 schema、技能内容、用户/助手消息、工具结果和压缩摘要共同占用。
- **Active Context**：本轮实际发送给模型的消息集合。它不必等于完整历史。
- **Transcript**：完整会话事实记录，用于调试、复盘和未来重新压缩，不应被 compact 破坏。
- **Compact Summary**：旧上下文的结构化摘要，用于替代被移出 active context 的旧消息。
- **Truncation**：兜底裁剪策略，只在 active context 超预算时发生，不能替代摘要压缩。
- **Context Usage**：估算输入 token / 可用输入预算。可用输入预算等于 context window 减去预留输出 token。

## 方案对比

| 方案 | 优点 | 缺点 | 当前取舍 |
| --- | --- | --- | --- |
| 最近消息窗口 | 简单、无额外模型调用 | 容易丢目标、决策和失败信息 | 只作为超预算兜底裁剪 |
| 滚动摘要 + 最近消息 | 平衡信息保留和实现复杂度 | 摘要可能遗漏或失真 | 作为 Day 9 主方案 |
| 分层摘要 | 适合很长任务和阶段回溯 | 数据结构和注入策略更复杂 | 预留 compact record，后续演进 |
| 向量检索记忆 | 可按需找回旧细节 | 需要 embedding/vector store | 留给 Memory/RAG 章节 |
| 工具结果压缩 | 从源头减少污染 | 需要逐个工具设置预算 | 当前先做 usage 观测 |
| Provider compaction | 原生模型服务支持 | provider lock-in，不利于学习内部机制 | 暂不接入 |
| Prompt caching | 降低成本和延迟 | 不减少上下文占用 | 后续 prompt builder 保持稳定前缀 |

## 当前实现

1. 新增 `ContextManager`，在模型调用前基于 context window、reserved output 和工具 schema 估算上下文占用。
2. 新增 `/context`，实时展示估算占用率、状态和 token 分类。
3. 新增 `TranscriptStore`，把完整消息流追加到 `memories/session/transcript.jsonl`。
4. 新增 `/compact`，用模型把完整历史压缩成结构化 summary，并保存到 `memories/session/compact.md`。
5. 压缩后 active context 变为：主 system prompt + mode prompt（如有）+ compact summary + compact 后的新消息。
6. 每次模型调用前执行 preflight；当 usage 超过 compact threshold 且存在可压缩的新消息时自动 compact。

## 默认阈值

- `AGENT_CONTEXT_WINDOW=32768`
- `AGENT_RESERVED_OUTPUT_TOKENS=4096`
- `AGENT_WARN_THRESHOLD=0.60`
- `AGENT_COMPACT_THRESHOLD=0.75`
- `AGENT_CRITICAL_THRESHOLD=0.90`
- `AGENT_SUMMARY_MAX_TOKENS=2048`
- `AGENT_RECENT_MESSAGE_MIN_TOKENS=8192`

## Node 设计决定

第一版使用近似 token estimator（约 4 字符/token），并把 estimator 做成可替换接口。这样当前实现不绑定 OpenAI tokenizer，也能适配本地 OpenAI-compatible provider。

## 验证

- `npm test` 覆盖 context config、usage 估算、active context 裁剪、transcript 持久化、manual compact、auto compact 和 renderer 展示。

## Open Questions

- 后续是否引入 provider-specific tokenizer 来减少估算误差？
- 工具结果是否应该在进入 history 前按类型做预算和结构化摘要？
- 长任务是否需要多段 compact summary，而不是单一最新 summary？
- Memory 章节是否把 transcript 中的 durable facts 提升为跨会话长期记忆？
