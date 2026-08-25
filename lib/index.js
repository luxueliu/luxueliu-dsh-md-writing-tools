// dsh-md-writing-tools: DSH host 插件入口
// 在 DSH 启动时自动对 dsh-better-sidebar 的 CodeMirror 编辑器做幂等注入，
// 补上 Markdown 写作格式化快捷键（加粗/斜体/删除线/行内代码/标题逐级/格式刷/链接）。
// better-sidebar 升级覆盖 bundle 后，重装本插件或重启 DSH 即自动重打。
//
// ⚠️ cordis 纪律：ctx 是严格代理，访问/写入未在 `inject` 中声明的属性会直接抛错，
// 插件 apply 抛错会导致整个 DSH 启动崩溃。因此：
//   - 本插件不访问任何未声明的 ctx 属性（不读写 ctx.xxx）；
//   - apply 内全 try/catch 兜底，任何异常只记录日志，绝不外抛。

import { applyInjection } from './inject.js';
import { pathToFileURL } from 'node:url';

export const name = 'md-writing-tools';
export const inject = [];

/** 注入结果日志（供 apply 与人工核查共用） */
export function describe(result) {
  if (!result.ok) return `[dsh-md-writing-tools] 跳过注入：${result.reason}`;
  if (result.injected) return `[dsh-md-writing-tools] 已注入 Markdown 写作快捷键 → ${result.bundle}`;
  return `[dsh-md-writing-tools] 已是最新（marker 存在，跳过）→ ${result.bundle}`;
}

/**
 * 插件入口：启动时注入一次。
 * 全部逻辑包在 try/catch 内：任何异常只 console.error，绝不抛给 cordis 加载器，
 * 保证插件出问题也不会让 DSH 起不来。
 */
export function apply(ctx) {
  try {
    const result = applyInjection();
    const msg = describe(result);
    // logger 仅在可用时使用（内部再兜一层，防止 ctx 属性访问本身抛错）
    try {
      if (ctx && typeof ctx.logger?.info === 'function') {
        ctx.logger.info(msg);
      } else {
        console.log(msg);
      }
    } catch {
      console.log(msg);
    }
  } catch (err) {
    try {
      console.error(`[dsh-md-writing-tools] apply 失败（已忽略，不影响 DSH 启动）: ${(err && err.message) || err}`);
    } catch {
      /* 最后一层：什么都不做 */
    }
  }
}

// 也支持独立运行：node lib/index.js（直接注入一次，便于升级后手动重打）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = applyInjection();
  console.log(describe(result));
}
