# Two-Week Practice Plan

这个计划按 14 天设计，主线改为官网 19 章路径。目标仍然不是堆功能，而是每天把一个机制讲透、跑通、记录下来。

## Day 1: Agent Loop

- 官网主题：s01 Agent 循环
- 理解目标：agent 和 chat completion 的差异在于 harness loop 会把真实工具结果回填给模型。
- Node 目标：把当前 `createAgent` 设计成 runner + LoopState。
- 产物：agent loop 流程图、runner 接口草案、最小交互记录。

## Day 2: Tool Use

- 官网主题：s02 工具使用
- 理解目标：工具 schema 是给模型看的，handler 是给系统执行的，中间需要 dispatch map。
- Node 目标：设计 tool registry、handler 签名、错误返回和 path sandbox。
- 产物：`bash/read_file/write_file/edit_file` 的最小工具层。

## Day 3: TodoWrite

- 官网主题：s03 待办写入
- 理解目标：todo 是会话内焦点管理，不是持久任务系统。
- Node 目标：实现内存 TodoManager 和 CLI 展示。
- 产物：`todo` 工具和多步任务演示。

## Day 4: Subagents

- 官网主题：s04 子代理
- 理解目标：子 agent 的价值是上下文隔离。
- Node 目标：抽象可复用 runner，支持一次性子任务。
- 产物：`task` 工具和子任务总结返回机制。

## Day 5: Skills

- 官网主题：s05 技能系统
- 理解目标：知识按需加载，通过 tool_result 注入，而不是塞满 system prompt。
- Node 目标：建立 `skills/*/SKILL.md` 约定和 loader。
- 产物：示例 skill、技能发现、`load_skill` 工具。

## Day 6: Context Compact

- 官网主题：s06 上下文压缩
- 理解目标：区分活跃上下文、压缩摘要和完整 transcript。
- Node 目标：设计 context manager、transcript 写入和手动 compact。
- 产物：压缩策略和压缩前后对比。

## Day 7: Permission + Hooks

- 官网主题：s07 权限系统、s08 Hook 系统
- 理解目标：工具执行前要先过权限管道，执行前后可以挂扩展点。
- Node 目标：实现 permission pipeline 和 hook registry 的最小版本。
- 产物：`allow/ask/deny` 决策、PreToolUse/PostToolUse 示例。

## Day 8: Memory + System Prompt

- 官网主题：s09 记忆系统、s10 系统提示词
- 理解目标：system prompt 是动态组装的控制面，memory 是可选择注入的长期状态。
- Node 目标：实现 prompt builder 和本地 memory store。
- 产物：prompt 快照测试、memory read/write 工具。

## Day 9: Error Recovery

- 官网主题：s11 错误恢复
- 理解目标：失败需要分类、回流和恢复策略，而不是简单 throw。
- Node 目标：设计 typed errors、retry policy 和 recoverable tool result。
- 产物：模型失败、工具失败、权限拒绝的恢复演示。

## Day 10: Task System

- 官网主题：s12 任务系统
- 理解目标：持久任务图解决跨步骤、跨阶段和依赖协调。
- Node 目标：实现 `.tasks/` JSON 任务存储和 ready rule。
- 产物：任务 CRUD、依赖解除、任务列表展示。

## Day 11: Background + Scheduler

- 官网主题：s13 后台任务、s14 定时调度
- 理解目标：后台任务解决慢操作，定时调度解决未来动作。
- Node 目标：实现后台进程 manager 和最小 scheduler loop。
- 产物：后台命令状态查询、到期任务触发。

## Day 12: Agent Teams + Protocols

- 官网主题：s15 Agent 团队、s16 团队协议
- 理解目标：团队协作需要持久身份、邮箱和结构化协议。
- Node 目标：设计 `.team/` roster、JSONL inbox 和 request-response 状态机。
- 产物：spawn、send、read_inbox、plan approval。

## Day 13: Autonomous Agents + Worktree Isolation

- 官网主题：s17 自主代理、s18 Worktree 隔离
- 理解目标：自主来自 idle loop + task board；隔离来自 task 与 worktree 绑定。
- Node 目标：实现自动 claim 设计和 `git worktree` 封装草案。
- 产物：自动领取未阻塞任务、worktree 生命周期记录。

## Day 14: MCP + Plugin + Integration Review

- 官网主题：s19 MCP 与插件，以及整体复盘
- 理解目标：MCP 把工具来源从本地硬编码扩展为外部可插拔能力。
- Node 目标：设计 MCP/plugin 接入边界，并整理整体架构。
- 产物：MCP 工具命名规则、plugin manifest 草案、Node terminal agent best practices 文档。

## 每日交付标准

每天结束前至少留下：

- 一段机制解释。
- 一个 Node 设计决定。
- 一个可运行实验或明确的技术 spike。
- 一个未解问题或下一步。
