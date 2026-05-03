# mini-agent

一个用 Node.js 从零构建的 terminal agent 练习项目。

这个仓库会优先保持“小而清楚”：先把终端入口、通用模型调用、消息循环、工具调用、上下文管理这些能力拆开写明白，再逐步补全成一个可用的 agent。

## 当前初始化内容

- 纯 Node.js ESM 项目，无外部依赖
- `mini-agent` CLI 入口
- OpenAI-compatible 模型客户端骨架，本地模型优先，也预留商业 API 接入
- 简单的终端对话循环
- 基于 `node:test` 的基础测试

## 环境要求

- Node.js 20+
- 一个模型服务，推荐先使用本地 OpenAI-compatible 服务，也可以换成商业 API

常见选择：

- Ollama
- LM Studio
- llama.cpp server
- vLLM

## 快速开始

```bash
cp .env.example .env
npm start
```

CLI 会自动读取本地 `.env`。如果模型服务没有启动或 API 配置错误，CLI 会提示连接失败。后续我们会把模型 provider、工具层和 agent loop 拆得更细。

## 配置

通过环境变量配置模型 provider：

```bash
MODEL_PROVIDER=local-openai-compatible
MODEL_BASE_URL=http://localhost:11434/v1
MODEL_NAME=qwen2.5-coder:7b
MODEL_API_KEY=local
```

`MODEL_BASE_URL` 应指向 OpenAI-compatible API 的根路径，当前客户端会请求：

```text
POST /chat/completions
```

## 项目结构

```text
src/
  agent/
    AgentRunner.js       # 最小 agent loop runner
    createAgent.js       # agent facade
    systemPrompt.js      # 初始系统提示词
  cli/
    terminal.js          # 终端输入输出循环
  config/
    localModelConfig.js  # 模型 provider 配置读取
    envFile.js           # 本地 .env 加载
  model/
    localModelClient.js  # OpenAI-compatible 模型客户端
  index.js               # CLI 入口
docs/
  learning/
    sessions/            # 每日实践记录
test/
  agent-runner.test.js
  config.test.js
  env-file.test.js
```

## 后续重写路线

1. 阅读你提供的网站文档和 Python 实现，整理概念映射。
2. 先重写最小 agent loop：输入、规划、模型调用、输出。
3. 加入 tool registry 和 tool calling。
4. 加入 terminal / filesystem 等可控工具能力。
5. 加入上下文压缩、任务状态、错误恢复。
6. 用完整代码过程反推 agent 的设计模型。

## 学习路线

后续实践会参考 `shareAI-lab/learn-claude-code` 和官网 19 章主题推进。我们已经把两周计划、主题索引、差异分析和每日记录模板沉淀在：

- [docs/learning/README.md](./docs/learning/README.md)
- [docs/learning/source-gap-analysis.md](./docs/learning/source-gap-analysis.md)
- [docs/learning/model-provider-plan.md](./docs/learning/model-provider-plan.md)
- [docs/learning/model-response-shape.md](./docs/learning/model-response-shape.md)
- [docs/learning/topic-index.md](./docs/learning/topic-index.md)
- [docs/learning/two-week-plan.md](./docs/learning/two-week-plan.md)
- [docs/learning/session-template.md](./docs/learning/session-template.md)
