# Session: Skills Scripts (2026-05-06)

## 目标

在已有 skills + references 基础上，引入可控脚本执行能力。

## 设计决策

1. 执行工具独立：新增 `run_skill`，不复用 `load_skill`。
2. 首期仅支持 Node 脚本：`.js/.mjs/.cjs`。
3. 目录约束：仅可执行 `skills/<name>/scripts/**` 中注册脚本。
4. 安全执行：不经过 shell，使用 `spawn(process.execPath, ...)`。
5. 资源限制：默认超时、输出截断、结构化执行结果。

## 主要改动

- `src/agent/skills/loadSkills.ts`
  - 增加 scripts 扫描并注册 `SkillConfig.scripts`
- `src/tools/skills/loadSkillTool.ts`
  - 增加 `list_scripts` action
- `src/tools/skills/runSchema.ts`
  - 新增 `run_skill` schema
- `src/tools/skills/runSkillTool.ts`
  - 新增 Node-only 脚本执行器
- `src/tools/defaultTools.ts`
  - 默认工具集接入 `run_skill`

## 验证

- 新增 `run_skill` 相关测试用例（成功执行、未知脚本错误）。
- 全量测试通过：`npm test`。
