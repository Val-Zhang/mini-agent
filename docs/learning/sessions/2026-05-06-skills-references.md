# Session: Skills References (2026-05-06)

## 目标

为 Day 8 的 skills 系统补充 `references` 支持，让技能正文保持精简，并允许模型按需加载参考资料。

## 关键设计

1. 参考资料发现规则：
   - `skills/<name>/reference.md`
   - `skills/<name>/references/**`
2. `load_skill` 增加两种 action：
   - `list_references`
   - `load_reference`
3. `load` 输出增加 reference 数量，帮助模型判断是否继续读取细节文档。

## 实现点

- `src/agent/skills/loadSkills.ts`
  - 启动时扫描并注册 reference 元信息（路径与来源）
- `src/agent/skills/types.ts`
  - 增加 `SkillReference` 与 `SkillConfig.references`
- `src/tools/skills/loadSkillTool.ts`
  - 新增 reference 列举/加载逻辑
- `src/tools/skills/schema.ts`
  - 更新 action 枚举与参数说明

## 测试

- `test/skills.test.ts` 增加：
  - reference 发现
  - list/load reference
  - 未知 reference 错误提示

全量测试通过：`npm test`。
