# Practice Note: TypeScript Structure Refactor

## Topic

- 日期：2026-05-03
- 目标：把项目迁移到 TypeScript，并调整文件结构，让核心逻辑更容易通过语义阅读。

## Design Intent

这次重构的重点不是新增 agent 能力，而是降低后续学习和实现成本：

- 核心文件只保留主流程。
- 通用协议类型放到外层 `src/types.ts`。
- 通用工具抽象放到 `src/tools/core/`。
- 某个模块内部才使用的辅助函数放到同模块 `utils/`。
- schema、格式转换、输入校验、状态快照从主流程文件拆出去。

## Structure

```text
src/
  types.ts
  agent/
    AgentRunner.ts
    createAgent.ts
    systemPrompt.ts
    utils/
      messages.ts
      state.ts
  model/
    localModelClient.ts
    utils/
      openAICompatible.ts
      response.ts
  tools/
    defaultTools.ts
    core/
      ToolRegistry.ts
      pathSandbox.ts
      types.ts
    bash/
      bashTool.ts
      schema.ts
      utils/
        command.ts
    filesystem/
      filesystemTools.ts
      schemas.ts
      utils/
        input.ts
        text.ts
```

## Reading Guide

如果想理解主链路，只需要先读：

1. `src/index.ts`
2. `src/cli/terminal.ts`
3. `src/agent/createAgent.ts`
4. `src/agent/AgentRunner.ts`
5. `src/model/localModelClient.ts`
6. `src/tools/defaultTools.ts`

如果想理解某个细节，再进入对应 `utils/`：

- assistant/tool message 格式：`src/agent/utils/messages.ts`
- LoopState 快照：`src/agent/utils/state.ts`
- OpenAI-compatible 工具格式：`src/model/utils/openAICompatible.ts`
- provider 响应归一化：`src/model/utils/response.ts`
- bash 子进程执行：`src/tools/bash/utils/command.ts`
- 文件工具输入和文本处理：`src/tools/filesystem/utils/`

## TypeScript Decisions

- 使用 `NodeNext`，保留 ESM 和 `.js` import specifier，编译后可直接由 Node 运行。
- `src/types.ts` 定义 `ModelClient`、`ModelResponse`、`ToolCall`、`ChatMessage` 等内部协议。
- `src/tools/core/types.ts` 定义工具层协议，避免工具实现反向依赖 agent。
- `npm start` 先编译再运行 `dist/src/index.js`。
- `npm test` 先编译，再运行 `dist/test/**/*.test.js`。

## Verification

- `npm run build`
- `npm test`

两者均通过。
