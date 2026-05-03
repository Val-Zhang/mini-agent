# Day 4: Subagents and Task Tool

## 目标

实现一个最小 `task` 工具，用来理解 subagent 的核心价值：不是启动一个更强的模型，而是启动一段隔离上下文。

主 agent 负责判断什么时候委托任务；子 agent 在自己的 message history 里完成探索；主 agent 只接收最终摘要。

## 核心机制

普通工具执行通常是：

```text
main agent -> tool handler -> tool result -> main agent
```

`task` 工具执行的是：

```text
main agent -> task tool -> child AgentRunner -> child final answer -> main agent
```

区别在于中间多了一个完整的 child agent loop。child agent 可以自己调用文件、bash、todo 等基础工具，但它的中间 messages 不会进入主 agent 的 history。

## 当前实现

新增文件：

```text
src/tools/task/
  schema.ts      # task 工具 schema
  taskTool.ts    # 创建 child AgentRunner 并返回子任务结果
```

接入点：

```text
src/tools/defaultTools.ts
src/agent/createAgent.ts
src/agent/prompts/main.ts
src/agent/subagents/
subagents/general.md
subagents/researcher.md
```

`createAgent()` 启动时会读取 `subagents/*.md`，把多个 Markdown subagent 配置加载成 `SubagentRegistry`。当目录缺失或为空时不注册 `task`；只有加载到配置后，`createDefaultTools({ workspaceRoot, subagents: { model, registry } })` 才会注册 `task`。

`task` 工具会根据输入里的 `subagent` 名称选择配置：

```json
{
  "subagent": "researcher",
  "description": "阅读 README.md 并总结项目目标"
}
```

如果不传 `subagent`，默认使用 `general`。子 agent 使用 `createBaseTools({ allowlist })` 创建新的基础工具实例，因此：

- 子 agent 有独立 message history。
- 子 agent 的 todo 状态不会污染主 agent 的 todo。
- 子 agent 只能看到自身配置里允许的工具。
- 子 agent 默认不再注册 `task`，先避免递归委托带来的复杂度。

## 为什么要隔离上下文

探索性任务经常会产生很多中间观察：

- 读取多个文件。
- 尝试命令。
- 对比实现路径。
- 过滤掉无关信息。

如果这些内容全部进入主会话，主上下文会变脏，也更容易干扰主 agent 的最终判断。

`task` 的价值是让主会话只看到压缩后的结果：

```text
Subtask result (researcher):
...
```

这和上下文压缩不同。上下文压缩是在同一条会话里把历史变短；subagent 是从一开始就把探索放到另一条 history 里。

## 最大轮次

`task` 工具有独立最大轮次：

```text
AGENT_TASK_MAX_TURNS
```

默认是 8，并且会受主 agent `AGENT_MAX_TURNS` 的上限影响。这样可以避免子任务无限循环。

## 测试覆盖

新增测试验证：

1. `task` 工具会创建 child agent 并返回结果。
2. child agent 的 system/user messages 不会合并进 parent history。
3. `task` 能按 subagent 名称选择 child agent。
4. 未知 subagent 会返回可用列表。
5. subagent tools allowlist 会真正限制 child agent 工具。
6. `subagents/*.md` 可以加载多个配置。
7. `AGENT_TASK_MAX_TURNS` 可以配置并有安全 fallback。

## 本地验证提示词

启动：

```bash
npm start
```

输入：

```text
请使用 researcher 子代理委托一个子任务：读取 README.md 前 5 行并总结这个项目的目标。主任务只需要基于子任务结果，用一句话说明这个项目在练习什么。
```

你应该观察到：

1. 主 agent 调用 `task`，并传入 `subagent: "researcher"`。
2. `task` 内部读取 registry 中的 researcher 配置。
3. child agent 只能使用 researcher 允许的工具。
4. 主 agent 收到 `Subtask result (researcher)` 后再组织最终回答。

## 下一步

后续可以继续扩展：

- 展示 child agent 的压缩 trace，而不是只展示 `task` 工具结果。
- 支持 task 并发。
- 给 task 增加权限边界。
- 支持 subagent model override。
- 在 context compact 章节里比较 subagent isolation 和 summary compact 的差异。
