// dsh-md-writing-tools: DSH host 插件入口
// 在 DSH 启动时自动对 dsh-better-sidebar 的 CodeMirror 编辑器做幂等注入，
// 补上 Markdown 写作格式化快捷键（加粗/斜体/删除线/行内代码/标题逐级/格式刷/链接）。
// better-sidebar 升级覆盖 bundle 后，重装本插件或重启 DSH 即自动重打。

import { applyInjection, locateEditorBundle, isInjected } from './inject.js';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const name = 'md-writing-tools';
export const inject = [];

/** 注入结果日志（供 apply 与人工核查共用） */
export function describe(result) {
  if (!result.ok) return `[dsh-md-writing-tools] 跳过注入：${result.reason}`;
  if (result.injected) return `[dsh-md-writing-tools] 已注入 Markdown 写作快捷键 → ${result.bundle}`;
  return `[dsh-md-writing-tools] 已是最新（marker 存在，跳过）→ ${result.bundle}`;
}

export function apply(ctx) {
  const result = applyInjection();
  const msg = describe(result);
  if (ctx?.logger?.info) {
    ctx.logger.info(msg);
  } else {
    console.log(msg);
  }
  // 暴露检查接口，便于用户/其他插件核查注入状态
  if (ctx?.mdWritingTools === undefined) {
    ctx.mdWritingTools = {
      isInjected: () => {
        const bundle = locateEditorBundle();
        if (!bundle) return { ok: false, reason: 'dsh-better-sidebar not installed' };
        return { ok: true, bundle, injected: isInjected(readFileSync(bundle, 'utf8')) };
      },
      reapply: () => {
        const r = applyInjection();
        return { ...r, message: describe(r) };
      },
    };
  }
}

// 也支持独立运行：node lib/index.js（直接注入一次，便于升级后手动重打）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = applyInjection();
  console.log(describe(result));
}
