# Topic Index

主参考目录： https://learn.shareai.run/zh/s01/ 到 https://learn.shareai.run/zh/s19/

GitHub 仓库： https://github.com/shareAI-lab/learn-claude-code

## 核心闭环

### s01: Agent 循环

- 核心问题：模型本身不能访问文件、执行命令或读取结果，需要 harness 把真实结果回填给模型。
- 机制重点：`messages`、`tool_use`、`tool_result`、turn、LoopState、退出条件。
- Node 实践重点：异步 agent runner、统一 ModelClient、provider registry、终端输入输出、工具结果回写。

### s02: 工具使用

- 核心问题：工具能力需要结构化描述、路由和受控执行。
- 机制重点：tool schema、dispatch map、handler、路径沙箱、错误返回。
- Node 实践重点：tool registry、`fs/promises`、`child_process`、工作区约束。

### s02.1: Discovery + Web Tools

- 核心问题：可用 agent 需要高效发现信息，而不是只靠模型猜路径或用 bash 拼命令。
- 机制重点：代码搜索、文件发现、目录枚举、网页读取、结果截断、来源标注。
- Node 实践重点：`grep` / `glob` / `list_dir` / `web_fetch` 工具，workspace sandbox，网络访问开关，统一检索输出格式。

### s03: 待办写入

- 核心问题：复杂任务中模型容易跳步、重复或忘记目标。
- 机制重点：TodoItem、PlanState、只能有一个 `in_progress`、计划状态提醒。
- Node 实践重点：内存状态管理、CLI 状态展示、任务进度工具。

### s04: 子代理

- 核心问题：探索性上下文会污染主会话。
- 机制重点：独立 `messages`、一次性子任务、总结回传。
- Node 实践重点：可复用 runner、最大轮次保护、子任务上下文隔离。

### s04.1: 配置化子代理

- 核心问题：一次性 `task` 工具只能表达“委托”，不能表达“委托给谁、允许做什么、最多跑多久”。
- 机制重点：subagent manifest、身份 prompt、工具 allowlist、maxTurns、model override。
- Node 实践重点：`subagents/*` 配置加载、schema 校验、`task` 支持 subagent name、默认 `general` 子 agent。

### s04.2: Plan Mode

- 核心问题：用户有时需要 agent 先拆解计划，而不是立刻执行文件、命令或外部工具。
- 机制重点：plan/execute 模式切换、计划草案、用户确认、工具调用冻结、确认后的执行恢复。
- Node 实践重点：terminal 模式状态、runner mode 参数、plan approval event、renderer 展示、permission pipeline 集成。

### s05: 技能系统

- 核心问题：领域知识不应一次性塞满 system prompt。
- 机制重点：技能摘要常驻、完整技能按需加载、通过 tool_result 注入。
- Node 实践重点：`skills/*/SKILL.md`、frontmatter、延迟加载。

### s06: 上下文压缩

- 核心问题：长会话和大量工具输出会填满上下文窗口。
- 机制重点：活跃上下文、摘要、完整 transcript、手动/自动压缩。
- Node 实践重点：消息裁剪、token 估算、会话保存、摘要恢复。

## 系统加固

### s07: 权限系统

- 核心问题：模型提出的工具调用不能直接变成真实动作。
- 机制重点：permission mode、deny/allow/ask、规则匹配、用户确认、plan approval。
- Node 实践重点：permission pipeline、bash 安全检查、交互式确认、plan mode 与 execute mode 的权限差异。

### s08: Hook 系统

- 核心问题：工具执行前后、会话开始结束时需要可插拔扩展点。
- 机制重点：PreToolUse、PostToolUse、SessionStart、SessionEnd、事件上下文。
- Node 实践重点：hook registry、同步/异步 hook、失败策略、审计日志。

### s09: 记忆系统

- 核心问题：agent 需要跨会话记住偏好、项目事实和长期知识。
- 机制重点：memory scope、读写时机、事实去重、上下文注入。
- Node 实践重点：本地 JSON/Markdown 存储、memory search、显式更新工具。

### s10: 系统提示词

- 核心问题：system prompt 是动态组装的控制面，不是一段固定文本。
- 机制重点：身份、规则、工具说明、模型能力、权限模式、plan/execute 模式、项目上下文、记忆、技能摘要、subagent manifest 摘要。
- Node 实践重点：prompt builder、section ordering、配置化开关、快照测试。

### s11: 错误恢复

- 核心问题：模型调用、工具执行、权限拒绝、上下文超限都会失败。
- 机制重点：错误分类、重试、降级、恢复提示、用户澄清。
- Node 实践重点：provider 错误归一化、typed errors、retry policy、recoverable result、失败注入测试。

## 任务运行时

### s12: 任务系统

- 核心问题：会话内 todo 不能表达依赖关系，也不能跨会话保存。
- 机制重点：TaskRecord、状态流转、`blockedBy`、ready rule、磁盘任务图。
- Node 实践重点：`.tasks/` JSON 存储、依赖查询、任务 CRUD。

### s13: 后台任务

- 核心问题：慢命令不能阻塞 agent loop。
- 机制重点：后台执行、通知队列、状态查询、结果注入。
- Node 实践重点：`child_process.spawn`、输出截断、进程状态、事件队列。

### s14: 定时调度

- 核心问题：agent 需要把未来动作登记到运行时，而不是只在当前 turn 里行动。
- 机制重点：scheduled task、cron/interval、到期触发、持久化。
- Node 实践重点：scheduler loop、时间解析、任务恢复、时区和进程生命周期。

## 多 Agent 平台

### s15: Agent 团队

- 核心问题：一次性 subagent 没有身份、生命周期或持续通信。
- 机制重点：roster、JSONL inbox、消息读取后清空、成员状态。
- Node 实践重点：`.team/`、文件消息总线、成员生命周期。

### s16: 团队协议

- 核心问题：团队协作需要结构化 request-response，而不是自由聊天。
- 机制重点：request id、pending/approved/rejected、shutdown、plan approval。
- Node 实践重点：协议类型、状态机、请求追踪、协议测试。

### s17: 自主代理

- 核心问题：团队成员不能永远等 lead 分配任务。
- 机制重点：idle phase、扫描 inbox、扫描任务板、自动 claim、身份重注入。
- Node 实践重点：调度循环、空闲超时、任务抢占约束。

### s18: Worktree 隔离

- 核心问题：多个 agent 在同一目录并行修改会互相干扰。
- 机制重点：任务和 worktree 绑定、独立执行目录、生命周期事件。
- Node 实践重点：`git worktree` 封装、工作区 registry、事件日志、清理策略。

### s19: MCP 与插件

- 核心问题：工具不应该全部写死在主程序里，外部程序也应能接入同一工具控制面。
- 机制重点：MCP client、list tools、call tool、工具名前缀、plugin manifest、permission/hook 复用。
- Node 实践重点：外部进程通信、MCP SDK/JSON-RPC、插件发现、统一 tool router、MCP tool adapter 到 `ToolDefinition`。
