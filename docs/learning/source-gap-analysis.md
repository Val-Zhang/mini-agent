# Source Gap Analysis

对比时间：2026-04-25

## 结论

官网 `https://learn.shareai.run/zh/s01/` 到 `https://learn.shareai.run/zh/s19/` 是更新后的 19 章学习路径；GitHub README 和我们最初参考的 docs/en 路线仍明显保留了 12 章教学仓库的结构。

所以后续实践应以官网 19 章为主线，GitHub 仓库源码作为参考实现来源。

## 为什么官网有 19 个主题

官网把原本 12 章中的“教学最小 harness”扩展成更完整的 agent 产品机制图谱：

- 原 12 章覆盖：loop、tools、todo、subagents、skills、compact、tasks、background、teams、protocols、autonomous、worktree。
- 官网 19 章新增：权限、hooks、memory、system prompt、error recovery、scheduler、MCP/plugins。
- 官网还把原来的后半段重新编号：原 s07 tasks 变成官网 s12，原 s12 worktree 变成官网 s18。

这也解释了 GitHub README 仍写 12 sessions 的原因：仓库 README 描述的是最小教学源码路径；官网文档已经把 omitted / advanced mechanisms 拆成独立章节。

## 新增缺口

相对原 12 章路线，官网 19 章多出 7 个关键主题：

| 官网章节 | 主题 | 补上的机制 |
| --- | --- | --- |
| s07 | 权限系统 | 工具调用从模型意图到真实执行之间的安全闸门 |
| s08 | Hook 系统 | 工具执行和会话生命周期前后的扩展点 |
| s09 | 记忆系统 | 跨会话保存长期偏好、事实和项目知识 |
| s10 | 系统提示词 | 动态组装角色、规则、能力、权限和上下文 |
| s11 | 错误恢复 | tool/model/runtime 失败后的恢复策略 |
| s14 | 定时调度 | 让 agent 能登记未来任务或周期任务 |
| s19 | MCP 与插件 | 外部工具服务和插件发现机制 |

## 编号映射

| 原 12 章路线 | 官网 19 章路线 |
| --- | --- |
| s01 Agent Loop | s01 Agent 循环 |
| s02 Tool Use | s02 工具使用 |
| s03 TodoWrite | s03 待办写入 |
| s04 Subagents | s04 子代理 |
| s05 Skills | s05 技能系统 |
| s06 Context Compact | s06 上下文压缩 |
| 新增 | s07 权限系统 |
| 新增 | s08 Hook 系统 |
| 新增 | s09 记忆系统 |
| 新增 | s10 系统提示词 |
| 新增 | s11 错误恢复 |
| s07 Task System | s12 任务系统 |
| s08 Background Tasks | s13 后台任务 |
| 新增 | s14 定时调度 |
| s09 Agent Teams | s15 Agent 团队 |
| s10 Team Protocols | s16 团队协议 |
| s11 Autonomous Agents | s17 自主代理 |
| s12 Worktree Isolation | s18 Worktree 隔离 |
| 新增 | s19 MCP 与插件 |

## 对我们计划的影响

原来的 14 天压缩计划已经调整为逐主题路线：

- 前 4 天打牢核心闭环：loop、tools、todo、一次性 subagent。
- 第 5-6 天补两个产品化前置能力：配置化 subagent、plan mode。
- 第 7-13 天进入系统加固：skills、compact、permission、hooks、memory、system prompt、error recovery。
- 第 14-16 天进入任务运行时：任务系统、后台任务、定时调度。
- 第 17-20 天进入多 agent 平台：团队、协议、自主、worktree。
- 第 21-22 天做 MCP/plugins 和整体复盘。

这样节奏更长，但每天只聚焦一个主题，更适合通过完整实现过程理解机制。
