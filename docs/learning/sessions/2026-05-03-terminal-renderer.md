# Practice Note: Terminal Renderer

## Topic

- 日期：2026-05-03
- 目标：把 agent 执行过程从“全量日志”改成可读、可扩展的 event-driven renderer。

## Problem

原来的输出把模型 content、工具 input、工具 output 全量按顺序打印。信息完整，但阅读成本高：

- JSON 太多。
- todo 状态埋在普通 tool output 里。
- 日常使用和 debug 使用混在一起。
- 后续加 permission、hook、subagent、background task 时会更乱。

## Design

新增 renderer 层：

```text
src/cli/renderers/
  createRenderer.ts
  compactRenderer.ts
  verboseRenderer.ts
  silentRenderer.ts
  types.ts
  utils/
    text.ts
    todoTracker.ts
    toolSummary.ts
```

`AgentRunner` 只 emit `AgentEvent`，不关心展示。

`terminal.ts` 只选择 renderer，并把事件交给 renderer。

renderer 决定如何展示：

- `compact`：默认，展示模型摘要、工具摘要、todo 面板。
- `verbose`：debug，展示完整 input/output。
- `off`：只展示最终结果。

通过环境变量选择：

```bash
AGENT_TRACE=compact
AGENT_TRACE=verbose
AGENT_TRACE=off
```

## Compact Output

紧凑模式优先回答：

1. 当前第几轮。
2. 模型打算做什么。
3. 调用了什么工具。
4. Todo 当前状态如何。

示例：

```text
[1] 模型
model>
  我会先创建三个待办。
  · todo add       读取 README 前 5 行
    ✓ todo_write (3ms)

Todo
  → 读取 README 前 5 行
  ○ 总结项目目标
```

## Todo Handling

`todo_write` 是 planning UI，不只是普通工具输出。

`TodoTracker` 会观察 todo tool 的输入输出，维护一个临时的 `id -> description` 映射，用于把：

```text
todo-xxx
```

展示成：

```text
读取 README 前 5 行
```

当 `todo_write list` 返回完整列表时，compact renderer 会展示专门的 Todo 面板。

## Verification

- `npm test`
- 新增 `test/renderers.test.ts`

测试覆盖：

- trace mode 选择
- compact renderer 摘要
- verbose renderer 完整 input/output
- off renderer 隐藏事件
