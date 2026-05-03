# Practice Roadmap

这个计划从“两周压缩版”调整为“逐主题实践路线”。原则是每次只聚焦一个机制：先讲清楚边界，再做一个最小可运行实现，最后沉淀笔记。

官网 19 章仍然是主线，但我们会在关键位置插入几个产品化主题：配置化 subagent、plan mode、MCP 接入边界。这些主题会影响后续架构，不能等到最后再补。

## Day 1: Agent Loop

- 官网主题：s01 Agent 循环
- 理解目标：agent 和 chat completion 的差异在于 harness loop 会把真实工具结果回填给模型。
- Node 目标：把当前 `createAgent` 设计成 runner + LoopState，并让 runner 只依赖统一 `ModelClient`。
- 产物：agent loop 流程图、runner 接口草案、模型 provider 边界草案、最小交互记录。

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

## Day 4: One-Shot Subagent

- 官网主题：s04 子代理
- 理解目标：子 agent 的价值是上下文隔离。
- Node 目标：抽象可复用 runner，支持一次性子任务。
- 产物：`task` 工具和子任务总结返回机制。

## Day 5: Configurable Subagents

- 官网主题：s04 子代理的产品化延伸
- 理解目标：subagent 不应该长期硬编码在 `task` 工具中，而应由配置描述身份、工具范围和运行约束。
- Node 目标：设计 `subagents/*` manifest，包含 name、description、prompt、tools allowlist、maxTurns、可选 model override。
- 产物：`general` / `researcher` 示例配置，`task` 支持按 subagent name 委托。

## Day 6: Plan Mode

- 官网主题：s07 权限系统、s10 系统提示词的前置交互模式
- 理解目标：区分“先计划”和“直接执行”。Plan mode 下 agent 应输出计划和预期动作，不能直接改文件或执行命令。
- Node 目标：设计 plan/execute 模式状态、terminal 切换命令、runner mode 参数、plan approval event。
- 产物：`/plan`、`/execute` 或等价模式切换；计划确认后再执行的最小闭环。

## Day 7: Discovery + Web Tools

- 官网主题：s02 工具使用的通用化延伸
- 理解目标：可用 agent 需要先发现信息，再决定行动；只靠 `read_file` 和 `bash` 会让检索成本过高，也不利于安全约束。
- Node 目标：
  - 实现 `grep` / `glob` / `list_dir` 等代码发现工具，优先使用 `ripgrep`，并限制 workspace。
  - 实现 `web_fetch`，支持读取 URL、提取正文、限制内容长度、返回来源信息。
  - 为搜索类工具设计统一输出格式：命中路径、行号、片段、截断提示。
  - 明确哪些能力用专用工具，哪些继续交给 `bash`。
- 产物：代码检索工具、网页读取工具、工具选择原则笔记。

## Day 8: Skills

- 官网主题：s05 技能系统
- 理解目标：知识按需加载，通过 tool_result 注入，而不是塞满 system prompt。
- Node 目标：建立 `skills/*/SKILL.md` 约定和 loader。
- 产物：示例 skill、技能发现、`load_skill` 工具。

## Day 9: Context Compact

- 官网主题：s06 上下文压缩
- 理解目标：区分活跃上下文、压缩摘要和完整 transcript。
- Node 目标：设计 context manager、transcript 写入和手动 compact。
- 产物：压缩策略和压缩前后对比。

## Day 10: Permission Pipeline

- 官网主题：s07 权限系统
- 理解目标：模型提出的工具调用不能直接变成真实动作，尤其是 bash、文件写入、MCP 外部工具。
- Node 目标：实现 `allow/ask/deny` 决策、工具匹配规则、交互式确认，并接入 plan approval。
- 产物：bash 写操作需要确认，plan mode 批准结果可影响后续权限。

## Day 11: Hooks

- 官网主题：s08 Hook 系统
- 理解目标：工具执行和会话生命周期前后需要可插拔扩展点。
- Node 目标：实现 hook registry、PreToolUse、PostToolUse、SessionStart、SessionEnd。
- 产物：审计日志 hook、工具执行耗时 hook、失败策略说明。

## Day 12: Memory

- 官网主题：s09 记忆系统
- 理解目标：agent 需要跨会话记住偏好、项目事实和长期知识，但不能污染短期任务上下文。
- Node 目标：实现本地 memory store、memory read/write 工具、事实去重策略。
- 产物：用户偏好记忆、项目事实记忆、注入策略笔记。

## Day 13: System Prompt Builder

- 官网主题：s10 系统提示词
- 理解目标：system prompt 是动态组装的控制面，不是一段固定字符串。
- Node 目标：实现 prompt builder，把身份、模式、工具说明、权限、skills、memory、subagents 摘要按稳定顺序组装。
- 产物：prompt 快照测试、plan/execute 模式差异测试。

## Day 14: Error Recovery

- 官网主题：s11 错误恢复
- 理解目标：模型调用、工具执行、权限拒绝、上下文超限都需要分类和恢复策略。
- Node 目标：设计 provider 错误归一化、typed errors、retry policy 和 recoverable tool result。
- 产物：模型失败、provider 失败、工具失败、权限拒绝的恢复演示。

## Day 15: Task System

- 官网主题：s12 任务系统
- 理解目标：会话内 todo 不能表达依赖关系，也不能跨会话保存。
- Node 目标：实现 `.tasks/` JSON 任务存储、依赖查询、ready rule。
- 产物：任务 CRUD、依赖解除、任务列表展示。

## Day 16: Background Tasks

- 官网主题：s13 后台任务
- 理解目标：慢命令不能阻塞 agent loop。
- Node 目标：实现后台进程 manager、输出截断、状态查询、结果注入。
- 产物：后台命令启动、查询、结束和错误输出展示。

## Day 17: Scheduler

- 官网主题：s14 定时调度
- 理解目标：agent 需要把未来动作登记到运行时，而不是只在当前 turn 行动。
- Node 目标：实现最小 scheduler loop、时间解析、到期任务触发。
- 产物：一次性计划任务、周期任务草案、时区和进程生命周期笔记。

## Day 18: Agent Teams

- 官网主题：s15 Agent 团队
- 理解目标：一次性 subagent 没有持久身份、邮箱或生命周期。
- Node 目标：设计 `.team/` roster、JSONL inbox、成员状态。
- 产物：spawn、send、read_inbox 的最小团队通信。

## Day 19: Team Protocols

- 官网主题：s16 团队协议
- 理解目标：团队协作需要结构化 request-response，而不是自由聊天。
- Node 目标：设计 request id、pending/approved/rejected、shutdown、plan approval 状态机。
- 产物：协议类型、请求追踪、协议测试。

## Day 20: Autonomous Agents

- 官网主题：s17 自主代理
- 理解目标：团队成员不能永远等 lead 分配任务，需要 idle loop 和任务领取规则。
- Node 目标：实现 idle phase、扫描 inbox、扫描任务板、自动 claim 草案。
- 产物：自动领取未阻塞任务的实验和风险清单。

## Day 21: Worktree Isolation

- 官网主题：s18 Worktree 隔离
- 理解目标：多个 agent 在同一目录并行修改会互相干扰，隔离来自 task 与 worktree 绑定。
- Node 目标：设计 `git worktree` 封装、工作区 registry、生命周期事件。
- 产物：worktree 创建、绑定、清理的最小 spike。

## Day 22: MCP + Plugin

- 官网主题：s19 MCP 与插件
- 理解目标：MCP 把工具来源从本地硬编码扩展为外部可插拔能力。
- Node 目标：实现最小 MCP adapter spike，让 MCP tool 适配到统一 `ToolDefinition`，并复用 permission、hooks、renderer。
- 产物：MCP 工具命名规则、plugin manifest 草案、最小 MCP tool adapter。

## Day 23: Product Hardening

- 官网主题：整体产品化补充
- 理解目标：脱离 demo 状态不只是增加工具，还要补齐配置、可观测性、安全边界、会话恢复和分发方式。
- Node 目标：
  - 统一配置文件：模型、工具开关、subagents、skills、permissions、MCP server。
  - 会话持久化：保存 transcript、运行事件、用户确认记录，支持继续上次会话。
  - 可观测性：结构化日志、trace 文件、debug 模式、错误报告。
  - 安全默认值：网络访问开关、写文件确认、命令 denylist/allowlist、敏感信息脱敏。
  - CLI 分发：bin 入口、版本信息、doctor 检查、配置初始化命令。
- 产物：product readiness checklist、配置草案、`mini-agent doctor` 设计。

## Day 24: Integration Review

- 官网主题：整体复盘
- 理解目标：把 model provider、agent loop、tools、skills、memory、subagents、permissions、MCP 放回同一张架构图。
- Node 目标：梳理模块边界、配置边界、测试策略和 terminal app best practices。
- 产物：最终架构笔记、未解问题清单、后续产品化路线。

## 每日交付标准

每天结束前至少留下：

- 一段机制解释。
- 一个 Node 设计决定。
- 一个可运行实验或明确的技术 spike。
- 一个未解问题或下一步。
