# 🖊️ dsh-md-writing-tools

> 给 `dsh-better-sidebar` 的 CodeMirror 编辑器装上 **Word 级 Markdown 写作快捷键**。
> host 侧幂等注入，`dsh-better-sidebar` 升级被覆盖后**一键装回即自动重打**。

[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-%2300b4ff)](https://github.com/topics/dsh-plugin)
[![dsh-better-sidebar](https://img.shields.io/badge/dsh--better--sidebar-ecosystem-blueviolet)](https://github.com/topics/dsh-better-sidebar)

## 这是什么

VS Code 里你可能用惯了一整套"给 Markdown 做 Word 操作"的快捷键（加粗/斜体/删除线/标题/格式刷……）。
`dsh-better-sidebar` 的编辑器是 CodeMirror，**默认只有 Ctrl+S 保存**，其它格式化键位一个没有。

本插件在 DSH 启动时自动向 `dsh-better-sidebar/lib/client-editor.js` 注入一套完整的 Markdown 格式化键位，
把它变成你熟悉的"Word 式写作"体验。

## 快捷键总表

| 快捷键 | 功能 | 说明 |
|---|---|---|
| `Ctrl/⌘+B` | **加粗** | 选中文字包 `**text**`；光标处插入占位 |
| `Ctrl/⌘+/` | *斜体* | 包 `*text*` |
| `Ctrl/⌘+-` | ~~删除线~~ | 包 `~~text~~` |
| `Ctrl/⌘+`` ` | 行内代码 | 包 `` `text` `` |
| `Ctrl/⌘+Alt+←` | 标题变小一级 | 对光标所在行/选中多行生效（`###` → `####`） |
| `Ctrl/⌘+Alt+→` | 标题变大一级 | `####` → `###`；无标题行加一级 `#` |
| `Ctrl/⌘+K` | 插入链接 | 选中文字 → `[text](url)`，光标停在 url 处 |
| `Ctrl/⌘+Alt+C` | 格式刷（复制格式） | 选中带格式文本，识别加粗/斜体/删除线/代码/标题 |
| `Ctrl/⌘+Alt+V` | 格式刷（粘贴格式） | 选中目标文本应用刚复制的格式 |
| `Esc` | 取消格式刷 | 清除已复制的格式 |

**智能行为**（移植自 VS Code `markdown-writing-tools`）：

- **重复按键 = 取消格式**：对已加粗文本再按 `Ctrl+B` 会去掉 `**`，不是越包越厚。
- **多行/整行感知**：跨多行选中时，对每一行分别处理；表格单元格、引用块、列表项、标题前缀都能保留。
- **标题逐级**：`Ctrl/Alt+←→` 对整行生效，支持引用块内标题（`> ## x`）。
- **格式刷**：先 `Ctrl+Alt+C` 复制（状态栏可感知），再选中目标 `Ctrl+Alt+V` 应用，一次即清。

## 安装

```powershell
# 推荐：从 GitHub 仓库安装（自动触发注入）
dsh plugin --profile web add luxueliu/luxueliu-dsh-md-writing-tools

# 或发布到 npm 后：
# dsh plugin --profile web add luxueliu-dsh-md-writing-tools
```

装完**重启 DSH**（插件在启动时注入），然后**硬刷新浏览器**（`Ctrl+Shift+R`）加载新的编辑器 bundle。

## better-sidebar 升级后一键装回

`dsh-better-sidebar` 升级会覆盖 `client-editor.js`（本地注入丢失）。此时：

```powershell
# 方式一：重装本插件（触发重新注入）
dsh plugin --profile web add luxueliu/luxueliu-dsh-md-writing-tools
# 方式二：直接重打（不经过插件安装流程，在插件仓库目录内执行）
node lib/index.js
```

注入是**幂等**的：检测到 marker（`/* dsh-md-writing-tools:injected */`）就跳过，文件被覆盖后自动重打，不会重复叠加。

## 原理

- `dsh-better-sidebar` 只向插件开放 `registerTab` / `registerFileViewer` / `openFile` 扩展点，**不提供编辑器 keymap API**。
- 因此本插件采用 host 侧注入：`apply(ctx)` 时定位 `dsh-better-sidebar/lib/client-editor.js`，
  在 CodeMirror 编辑器创建处插入格式化函数 + keymap 挂载（`...mdwtKeymap`），写回文件。
- 插入代码全部为浏览器端普通 JS（无依赖），打包产物语法校验通过。
- 备份：注入前若存在 `.bak.*` 基线备份，可用 `restoreAndInject()` 还原后再注入。

## 目录结构

```
lib/
  index.js      # DSH 插件入口：apply() 时自动注入
  inject.js     # 注入器：定位 bundle / 幂等检查 / 注入 / 备份还原
  snippet.txt   # 注入到浏览器 bundle 的代码块（格式化函数 + keymap）
package.json
README.md
```

## 开发

```powershell
node --check lib/index.js && node --check lib/inject.js   # 语法检查
node lib/index.js                                         # 手动触发一次注入
```

## Roadmap / 已知限制

- **本地 MD 双击默认用 dsh 侧边栏打开**：已调研，当前**无现成通道**——
  - DSH web 核心无 URL 深链参数（`?open=`/`?path=` 均不支持）；
  - `dsh-better-sidebar` 的 `/sidebar/api` 无 `open` 方法（只有 fs/git/sidechat 等）；
  - `sidebar_open` 背后的推送通道（`AgentOpenRegistry`）是 better-sidebar **内部对象，不对外暴露**。
  - 要落地需上游支持（DSH/better-sidebar 加深链或 open HTTP 端点）或本地补丁（重装即丢，不推荐）。
  - 当前替代：聊天里文件链接点击（`interceptOpenPath` 默认开）→ 侧边栏编辑器打开，走的是同一套渲染。

## License

MIT
