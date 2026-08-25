// dsh-md-writing-tools: host 侧幂等注入器
// 目标：dsh-better-sidebar 的 client-editor.js（CodeMirror 编辑器创建区）
// 机制：检查 marker -> 未注入则插入 snippet.txt 代码块 + keymap 挂载，写回文件
// 幂等：重复执行检测 marker 直接跳过；better-sidebar 升级后文件变回原样 -> 再次注入

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const MARKER = '/* dsh-md-writing-tools:injected */';
export const EDITOR_ANCHOR = 'const view = new EditorView({';
export const KEYMAP_ANCHOR = 'keymap.of([';

// 注入的浏览器端代码块（snippet.txt，插到 EDITOR_ANCHOR 之前）。
// 独立文件避免模板字符串转义问题（注入代码含反引号键位等）。
export function loadSnippet() {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, 'snippet.txt'), 'utf8');
}

// 定位 better-sidebar 的 client-editor.js：
// 1) 插件装进 profile 后，从插件自身位置解析（与 better-sidebar 同 node_modules 平级）；
// 2) 开发态/独立运行时，回退搜索 DSH_HOME 下所有 profile 的 node_modules。
export function locateEditorBundle() {
  const require = createRequire(import.meta.url);
  const tries = [];
  try {
    const pkgPath = require.resolve('dsh-better-sidebar/package.json');
    tries.push(join(dirname(pkgPath), 'lib', 'client-editor.js'));
  } catch {
    /* 发布前开发态解析不到，走回退 */
  }
  // 回退：DSH_HOME 环境变量，默认 ~/.dsh
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
  const profilesDir = join(dshHome, 'profiles');
  const { readdirSync, existsSync } = require('node:fs');
  if (existsSync(profilesDir)) {
    let dirs = [];
    try { dirs = readdirSync(profilesDir); } catch { dirs = []; }
    for (const profile of dirs) {
      const candidate = join(profilesDir, profile, 'node_modules', 'dsh-better-sidebar', 'lib', 'client-editor.js');
      if (existsSync(candidate)) tries.push(candidate);
    }
  }
  return tries[0] ?? null;
}

export function isInjected(source) {
  return source.includes(MARKER);
}

// 挂载点插入片段（keymap.of([ 之后）
const KEYMAP_INSERT = '...mdwtKeymap,';

// 对给定文件执行注入；返回结果对象
export function injectEditorBundle(filePath) {
  const source = readFileSync(filePath, 'utf8');
  if (isInjected(source)) return { injected: false, reason: 'already-injected' };
  const anchorIndex = source.indexOf(EDITOR_ANCHOR);
  if (anchorIndex < 0) throw new Error('editor anchor not found: ' + EDITOR_ANCHOR);
  const keymapIndex = source.indexOf(KEYMAP_ANCHOR);
  if (keymapIndex < 0) throw new Error('keymap anchor not found: ' + KEYMAP_ANCHOR);
  const injection = loadSnippet();
  // 先插代码块（anchor 前）。注意：snippet 使文件整体右移了 injection.length，
  // 因此挂载点 keymap.of([ 的位置必须在 patched 上重新定位——
  // 用原始 keymapIndex 会插进 snippet 内部，快捷键全部失效（已踩坑）。
  const patched = source.slice(0, anchorIndex) + injection + source.slice(anchorIndex);
  const patchedKeymapIndex = patched.indexOf(KEYMAP_ANCHOR);
  if (patchedKeymapIndex < 0) throw new Error('keymap anchor not found after snippet insert: ' + KEYMAP_ANCHOR);
  const insertPos = patchedKeymapIndex + KEYMAP_ANCHOR.length;
  const patched2 = patched.slice(0, insertPos) + KEYMAP_INSERT + patched.slice(insertPos);
  writeFileSync(filePath, patched2, 'utf8');
  return { injected: true, reason: 'injected' };
}

// 一键注入（默认路径定位）
export function applyInjection() {
  const bundle = locateEditorBundle();
  if (!bundle) return { ok: false, reason: 'dsh-better-sidebar not installed' };
  try {
    return { ok: true, bundle, ...injectEditorBundle(bundle) };
  } catch (err) {
    return { ok: false, reason: String((err && err.message) || err) };
  }
}

// 从基线重建（调试/升级后重打用）：把目标文件替换为该目录下最新的 .bak 备份，再注入。
// 自动匹配 client-editor.js.bak.*，避免硬编码本机备份名。
export function restoreAndInject(bundle) {
  const bakDir = dirname(bundle);
  const stem = basename(bundle, '.js');
  const baks = readdirSync(bakDir)
    .filter((name) => name.startsWith(stem + '.js.bak'))
    .sort();
  if (baks.length === 0) throw new Error('no .bak baseline found for ' + bundle);
  const bak = join(bakDir, baks[baks.length - 1]);
  const base = readFileSync(bak, 'utf8');
  writeFileSync(bundle, base, 'utf8');
  return injectEditorBundle(bundle);
}
