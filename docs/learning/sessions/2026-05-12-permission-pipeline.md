# Session: Day 10 Permission Pipeline (2026-05-12)

## Goal

实现一个最小但可观察的 permission pipeline，让模型提出的工具调用先经过统一决策，再决定执行、确认或拒绝。

## Core Concepts

- **Permission decision**：执行前决策为 `allow`、`ask` 或 `deny`。
- **Visible tools**：模型在 plan mode 下只能看到只读规划工具；这是提示层和工具 schema 层的限制。
- **Execution gate**：即使模型提出了工具调用，runner 仍会在真实执行前检查权限。
- **Approved plan context**：`/implement` 执行已批准计划时会把 `planApproved` 传入 runner，允许计划内文件写入跳过二次确认。

## Implementation

1. 新增 `src/agent/permissions/`：
   - `types.ts`：权限请求、结果、确认回调类型。
   - `bashClassifier.ts`：保守的 bash 字符串分类器。
   - `permissionManager.ts`：集中处理工具级规则。
2. `AgentRunner` 在 `executeToolCall` 前调用 permission manager：
   - `deny`：不执行工具，返回错误 tool result。
   - `ask`：调用 `confirmPermission`；用户拒绝则不执行。
   - `allow`：继续走原工具执行路径。
3. 新增 `permission_decided` 事件，compact / verbose / silent renderer 会展示需要注意的 ask / deny。
4. CLI 提供交互确认：
   - TTY 下询问 `Allow? [y/N]`。
   - 非 TTY 下默认拒绝 ask 类请求。
5. `/implement` 调用 `sendMessage(..., { planApproved: true })`，把已批准计划接入权限上下文。

## Current Rules

- Plan mode：
  - 允许：`read_file`、`todo_write`、`list_dir`、`glob`、`grep`、`web_fetch`、`load_skill`。
  - 其他工具：`deny`。
- Execute mode：
  - 只读工具：`allow`。
  - `write_file` / `edit_file`：默认 `ask`，已批准 plan 下 `allow`。
  - `bash`：
    - 常见只读命令如 `git status`、`git diff`、`rg`、`sed -n`：`allow`。
    - 可能修改状态的命令、重定向、管道和复合命令：`ask`。
    - `rm -rf`、`git reset --hard`、`sudo`、`curl | bash`：`deny`。
  - 其他 execute-mode 扩展工具：默认 `allow`，保持自定义工具和 `task` 的兼容性。

## Tests

- `test/permissions.test.ts` 覆盖权限规则和 bash 分类。
- `test/agent-runner.test.ts` 覆盖 allow / ask / deny 的执行效果、用户拒绝、危险 bash 拒绝、approved plan 写入。
- `test/renderers.test.ts` 覆盖 permission event 展示。

## Trade-offs

- Bash 分类器不是 shell parser，只做保守启发式分类。
- 暂不做项目级权限配置、持久批准或 per-command allowlist。
- 默认允许未知 execute 工具是为了不破坏现有扩展点；后续接 MCP 时应给外部工具补更细的来源和风险元数据。

## Next Step

- Day 11 Hook 系统：把工具执行前后的审计、耗时记录和失败策略做成可插拔 hook。
- 后续 Product Hardening：把 permission rules 抽到配置文件，并支持一次性/会话级/永久批准。
