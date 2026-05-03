# Practice Note: Terminal Input

## Topic

- 日期：2026-05-03
- 目标：让终端交互符合 agent 输入习惯：Enter 发送，Shift+Enter / Command+Enter 换行，并在请求执行时提示发送中。

## Design

`readline.question()` 适合单行输入，但它不适合 agent 风格的多行输入框。现在 CLI 分为两条路径：

- TTY 交互：`src/cli/inputEditor.ts` 使用 raw mode 和 `readline.emitKeypressEvents()` 自己处理按键。
- 非 TTY 管道：保留逐行读取模式，确保 `printf '...\n' | npm start` 仍可用于自动化验证。

## Behavior

- 普通 Enter：提交当前输入。
- Shift+Enter / Command+Enter：在终端能提供 modifier 信息或常见 escape sequence 时插入换行。
- Ctrl+C：结束输入。
- Ctrl+D：空输入时结束。
- Ctrl+U：清空当前输入。
- Backspace：删除最后一个字符。

提交后终端会先输出：

```text
agent> 发送中...
```

然后再输出最终模型回复。

## Terminal Limitation

Command+Enter / Shift+Enter 是否能被 Node 区分，取决于终端是否把它们发送成不同的 key modifier 或 escape sequence。如果终端把它们都发成普通 Enter，应用层无法可靠区分。

当前支持的 modified enter 信号在 `src/cli/utils/keys.ts` 中集中维护。

## Verification

- `npm run build`
- `npm test`
- `printf '/exit\n' | npm start`
