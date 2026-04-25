# mini-agent

一个用 Node.js 从零构建的 terminal agent 练习项目。

这个仓库会优先保持“小而清楚”：先把终端入口、本地模型调用、消息循环、工具调用、上下文管理这些能力拆开写明白，再逐步补全成一个可用的 agent。

## 当前初始化内容

- 纯 Node.js ESM 项目，无外部依赖
- `mini-agent` CLI 入口
- OpenAI-compatible 本地模型客户端骨架
- 简单的终端对话循环
- 基于 `node:test` 的基础测试

## 环境要求

- Node.js 20+
- 一个本地模型服务，最好兼容 OpenAI Chat Completions API

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

如果本地模型服务没有启动，CLI 会提示连接失败。后续我们会把模型层、工具层和 agent loop 拆得更细。

## 配置

通过环境变量配置本地模型：

```bash
LOCAL_MODEL_BASE_URL=http://localhost:11434/v1
LOCAL_MODEL_NAME=qwen2.5-coder:7b
LOCAL_MODEL_API_KEY=local
```

`LOCAL_MODEL_BASE_URL` 应指向 OpenAI-compatible API 的根路径，当前客户端会请求：

```text
POST /chat/completions
```

## 项目结构

```text
src/
  agent/
    createAgent.js       # 最小 agent facade
  cli/
    terminal.js          # 终端输入输出循环
  config/
    localModelConfig.js  # 本地模型配置读取
  model/
    localModelClient.js  # OpenAI-compatible 模型客户端
  index.js               # CLI 入口
test/
  config.test.js
```

## 后续重写路线

1. 阅读你提供的网站文档和 Python 实现，整理概念映射。
2. 先重写最小 agent loop：输入、规划、模型调用、输出。
3. 加入 tool registry 和 tool calling。
4. 加入 terminal / filesystem 等可控工具能力。
5. 加入上下文压缩、任务状态、错误恢复。
6. 用完整代码过程反推 agent 的设计模型。
