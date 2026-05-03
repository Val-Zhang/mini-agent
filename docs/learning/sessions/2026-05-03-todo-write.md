# Practice Session: Todo Write

## Topic

- 日期：2026-05-03
- 参考主题：https://learn.shareai.run/zh/s03/
- 目标：实现 TodoWrite 工具，让 agent 可以把多步任务的焦点状态外置到可观察的工具中。

## Mechanism

s03 的核心问题是：复杂任务中模型容易跳步、重复或忘记目标。

解决方案是把任务状态从隐式的"模型记忆"变成显式的"工具可见状态"：

1. **TodoItem**：每个任务有 id、description、status（pending/in_progress/completed）、时间戳。
2. **PlanState**：包含所有 todo items 和当前焦点（currentFocus）。
3. **单一焦点约束**：同一时间只能有一个 `in_progress` 任务，强制 agent 完成当前任务再开始下一个。
4. **会话内状态**：todos 保存在当前工具实例内，重启后从空状态开始，避免练习数据污染后续验证。

## Python Reference Notes

教学版的关键设计：

- `TodoItem` 数据类包含 id、description、status、created_at、updated_at。
- `PlanState` 维护 items 列表和 current_focus。
- `todo_write` 工具支持 add、update、complete、list 四种操作。
- 状态转换时强制检查：设置 in_progress 前必须确保没有其他任务在进行中。
- 工具返回格式化的任务列表，用状态图标（○ pending、→ in_progress、✓ completed）增强可读性。

## Node Mapping

### 文件结构

```text
src/tools/todo/
  types.ts       # TodoItem、TodoStatus、PlanState 类型定义
  state.ts       # TodoState 类，负责内存状态管理
  schema.ts      # todo_write 工具的 OpenAI-compatible schema
  todoTool.ts    # 工具定义和执行逻辑
```

### 核心实现

**TodoState 类**：
- `add(description)`：创建新 todo，生成唯一 id，状态默认为 pending。
- `update(id, updates)`：更新 todo 的 description 或 status，强制单一 in_progress 约束。
- `complete(id)`：快捷方法，将 todo 标记为 completed。
- `list()`：返回完整 PlanState。
- `formatList()`：格式化输出，包含状态图标、焦点标记和统计摘要。

**单一焦点约束**：
```typescript
if (updates.status === 'in_progress') {
  const currentInProgress = this.state.items.find(t => t.status === 'in_progress' && t.id !== id);
  if (currentInProgress) {
    throw new Error(`Cannot set ${id} to in_progress: ${currentInProgress.id} is already in progress.`);
  }
  this.state.currentFocus = id;
}
```

**工具 schema**：
- `action`：add/update/complete/list
- `id`：update 和 complete 需要
- `description`：add 需要，update 可选
- `status`：update 时可选，值为 pending/in_progress/completed

### 与其他工具的集成

在 `src/tools/defaultTools.ts` 中注册：
```typescript
return [
  createBashTool({ workspaceRoot: sandbox.root }),
  ...createFilesystemTools({ sandbox }),
  createTodoTool({ workspaceRoot: sandbox.root })
];
```

## Experiment

### 单元测试

创建了 `test/todo.test.ts`，覆盖以下场景：

1. ✅ 添加新 todo
2. ✅ 列出空 todos
3. ✅ 列出带状态图标的 todos
4. ✅ 更新 todo 状态为 in_progress
5. ✅ 强制单一 in_progress 约束
6. ✅ 完成 todo
7. ✅ 更新 todo 描述
8. ✅ 当前工具实例内保留状态
9. ✅ 新工具实例从空状态开始
10. ✅ 缺少必填字段时返回错误
11. ✅ 不存在的 todo 返回错误

所有测试通过（27/27）。

### 真实 Provider 验证

待验证场景：
```bash
printf '请帮我完成以下任务：1. 读取 README.md 的前 5 行 2. 创建一个新文件 summary.txt 3. 把摘要写入文件。请使用 todo_write 工具追踪进度。\n/exit\n' | npm start
```

期望行为：
1. Agent 调用 `todo_write` 添加 3 个任务
2. 依次将每个任务设为 in_progress
3. 完成后标记为 completed
4. 最后列出所有任务状态

## Design Decisions

### 为什么当前用内存而不是 JSON？

TodoWrite 在这个阶段用于会话内焦点管理，不是长期任务系统。使用内存状态可以：

- 每次启动都是干净练习环境。
- 避免历史 todo 污染 terminal 展示。
- 更贴近 s03 的核心目的：帮助模型在当前复杂任务中保持进度。

后续跨会话任务会放到 Task System 章节处理。

### 为什么强制单一焦点？

防止 agent 同时开始多个任务导致：
- 上下文切换混乱
- 任务半途而废
- 难以追踪真实进度

### ID 生成策略

使用 `todo-${timestamp}-${random}` 格式：
- 时间戳保证大致有序
- 随机后缀避免冲突
- 可读性比 UUID 好

## Open Questions

- 是否需要支持任务依赖关系（blockedBy）？s03 没有，但 s12 会引入。
- 是否需要支持任务优先级？当前按添加顺序。
- 是否需要支持任务删除？当前只能 complete。
- `.agent/` 目录是否应该加入 `.gitignore`？

## Next Step

- Day 4：实现 Subagent，让探索性任务在独立上下文中执行，避免污染主会话。
- 用真实 provider 验证 TodoWrite 在多步任务中的效果。
- 考虑在 system prompt 中提示 agent 使用 todo_write 追踪复杂任务。
