# Agent Learning Track

这个目录用于承载我们后续两周左右的实践路线。参考主题来自：

- https://github.com/shareAI-lab/learn-claude-code
- https://learn.shareai.run/zh/s01/ 到 https://learn.shareai.run/zh/s19/

我们的目标不是快速堆功能，而是通过 Node.js 重写一个 terminal agent 的过程，把两个问题弄透：

1. Agent harness 的机制到底如何分层。
2. Node.js 里 terminal 应用的基本范式和最佳实践是什么。

## 学习原则

- 每天只实践一个核心主题，先讲清机制，再写最小代码。
- 每个主题都保留一份学习记录：概念、设计、Node 映射、实验、未解问题。
- 代码实现追求可运行、可观察、可解释，不追求一次到位。
- 每次新增能力时，先确认它属于 agent loop、tool layer、memory、task system、team coordination 还是 execution isolation。
- 对 Python 实现的迁移以语义为主，不逐行翻译。

## 文件说明

- [source-gap-analysis.md](./source-gap-analysis.md)：官网 19 章和 GitHub 12 章路线的差异说明。
- [two-week-plan.md](./two-week-plan.md)：两周实践路线。
- [topic-index.md](./topic-index.md)：19 个参考主题的机制索引。
- [session-template.md](./session-template.md)：每日实践记录模板。

## 推荐节奏

每次实践按这个顺序推进：

1. 阅读对应参考文档和 Python 实现。
2. 用自己的话解释机制。
3. 画出 Node.js 模块边界。
4. 实现最小可运行版本。
5. 在 terminal 中跑一次真实交互。
6. 记录这次学到的范式、坑和下一步。
