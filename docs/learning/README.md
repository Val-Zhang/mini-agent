# Agent Learning Track

这个目录用于承载我们后续逐主题推进的实践路线。参考主题来自：

- https://github.com/shareAI-lab/learn-claude-code
- https://learn.shareai.run/zh/s01/ 到 https://learn.shareai.run/zh/s19/

我们的目标不是快速堆功能，而是通过 Node.js 重写一个 terminal agent 的过程，把两个问题弄透：

1. Agent harness 的机制到底如何分层。
2. Node.js 里 terminal 应用的基本范式和最佳实践是什么。

## 学习原则

- 每天只实践一个核心主题，先讲清机制，再写最小代码。
- 每个主题都保留一份学习记录：概念、设计、Node 映射、实验、未解问题。
- 代码实现追求可运行、可观察、可解释，不追求一次到位。
- 模型调用保持 provider 化：本地模型优先，但 agent runner 不绑定具体模型来源。
- 工具层逐步从教学最小集扩展到通用可用集：代码检索、目录发现、网页读取、后台任务、MCP。
- 进行后续任务前，优先调研社区最佳实践（官方文档、成熟开源实现、工程约束），再确定实现方案。
- 每次新增能力时，先确认它属于 agent loop、tool layer、memory、task system、team coordination 还是 execution isolation。
- 脱离 demo 状态需要同时关注配置、权限、日志、会话恢复、网络边界和分发体验。
- 对 Python 实现的迁移以语义为主，不逐行翻译。

## 文件说明

- [source-gap-analysis.md](./source-gap-analysis.md)：官网 19 章和 GitHub 12 章路线的差异说明。
- [model-provider-plan.md](./model-provider-plan.md)：本地模型和商业 API 的统一调用计划。
- [model-response-shape.md](./model-response-shape.md)：内部 `ModelResponse` 协议笔记。
- [two-week-plan.md](./two-week-plan.md)：逐主题实践路线。
- [topic-index.md](./topic-index.md)：19 个参考主题的机制索引。
- [session-template.md](./session-template.md)：每日实践记录模板。

## 推荐节奏

每次实践按这个顺序推进：

1. 阅读对应参考文档和 Python 实现。
2. 快速调研社区最佳实践，提炼可落地的默认决策。
3. 用自己的话解释机制。
4. 画出 Node.js 模块边界。
5. 实现最小可运行版本。
6. 在 terminal 中跑一次真实交互。
7. 记录这次学到的范式、坑和下一步。
