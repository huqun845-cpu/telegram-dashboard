#!/usr/bin/env node
/* ============================================================
 * bake-meta.mjs
 * 把 meta.json 里 GitHub API 实抓到的真值，直接烘焙进 data.js
 * ------------------------------------------------------------
 * 动机：meta.generated.js 一旦丢失/没导入，面板会退回显示「推断值」，
 *       把真值写进 data.js 后，data.js 自身即是可信的。
 *
 * 烘焙字段：
 *   lic / licKind / comm / maint  → 用 API 真值覆盖推断值
 *   pushedAt / stars / forks      → 新增（面板会自动当作真实数据使用）
 *   src:'api'                     → 标记「这些字段来自 API 实测」
 *
 * 安全性：
 *   - 会先备份 data.js.bak
 *   - 写完后重新 require 对比「除新增字段外的所有字段」，
 *     任一不一致立即回滚并报错（防止格式化过程丢数据）
 *   - 幂等：重复执行结果一致
 *
 * 附带效果（自动备注）：
 *   无 LICENSE 的仓库 → 备注「法律上默认保留所有权利」
 *   已归档的仓库       → 备注「作者已停止维护」
 *
 * 用法：
 *   node bake-meta.mjs            # 烘焙
 *   node bake-meta.mjs --check    # 只检查差异，不写入
 * ============================================================ */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(DIR, 'data.js');
const META_FILE = path.join(DIR, 'meta.json');
const BAK_FILE = path.join(DIR, 'data.js.bak');
const CHECK_ONLY = process.argv.includes('--check');

/* ---------- 1. 读取现有数据 ---------- */
const require_ = createRequire(import.meta.url);
delete require_.cache?.[DATA_FILE];
const { PROJECTS, CATEGORIES, LANGS } = require_(DATA_FILE);
const meta = JSON.parse(await readFile(META_FILE, 'utf8'));
const okMeta = Object.fromEntries(Object.entries(meta).filter(([, v]) => v && !v.error));

/* ---------- 2. 计算烘焙后的值 ---------- */
const daysAgo = d => Math.round((new Date() - new Date(String(d).slice(0, 10) + 'T00:00:00')) / 86400000);
function maintOf(m) {
  if (m.archived) return 'stale';
  if (!m.pushedAt) return null;
  const d = daysAgo(m.pushedAt);
  return d <= 90 ? 'active' : d <= 365 ? 'maintained' : 'stale';
}
function commOf(licKind, original) {
  if (original === 'no') return 'no';               // 营销/赌博类始终保持「不建议」
  if (licKind === 'permissive') return 'yes';
  if (licKind === 'copyleft') return 'caution';
  return 'unknown';                                  // 无协议 ≠ 可商用，保持待核实
}

const stats = { baked: 0, licChanged: 0, maintChanged: 0, commChanged: 0, noLicense: 0, archived: 0, autoNoted: 0 };
const baked = PROJECTS.map(p => {
  const m = okMeta[p.id];
  if (!m) return { ...p };
  const o = { ...p };
  const licKind = m.licenseKind || (m.license
    ? (/^(MIT|Apache|BSD|ISC|Unlicense|0BSD|CC0)/i.test(m.license) ? 'permissive' : /GPL/i.test(m.license) ? 'copyleft' : 'unknown')
    : 'unknown');

  if (o.lic !== m.license) stats.licChanged++;
  if (!m.license) stats.noLicense++;
  if (m.archived) stats.archived++;

  const newMaint = maintOf(m);
  const newComm = commOf(licKind, o.comm);
  if (o.maint !== newMaint && newMaint) stats.maintChanged++;
  if (o.comm !== newComm) stats.commChanged++;

  o.lic = m.license || null;
  o.licKind = licKind;
  o.comm = newComm;
  if (newMaint) o.maint = newMaint;
  o.pushedAt = m.pushedAt ? String(m.pushedAt).slice(0, 10) : null;
  o.stars = typeof m.stars === 'number' ? m.stars : null;
  o.forks = typeof m.forks === 'number' ? m.forks : null;
  o.src = 'api';

  /* 自动备注：无协议 / 已归档 —— 选型时最容易踩的两个坑，直接写进条目 */
  const auto = [];
  if (!m.license) auto.push('无 LICENSE 文件：法律上默认「保留所有权利」，商用前需先联系作者授权');
  if (m.archived) auto.push('仓库已归档（archived），作者已停止维护');
  if (auto.length) {
    const keep = String(o.note || '').split('；').filter(s => s.trim() && !/(无 LICENSE|保留所有权利|已归档)/.test(s));
    o.note = auto.concat(keep).join('；');
    stats.autoNoted++;
  }

  stats.baked++;
  return o;
});

console.log(`📊 meta.json 中有效数据：${Object.keys(okMeta).length} 个 → 烘焙 ${stats.baked} 条`);
console.log(`   许可证修正 ${stats.licChanged} · 维护状态修正 ${stats.maintChanged} · 商用结论修正 ${stats.commChanged}`);
console.log(`   其中无协议 ${stats.noLicense} 个 · 已归档 ${stats.archived} 个 · 自动补备注 ${stats.autoNoted} 条`);

/* ---------- 3. 序列化（单引号 + 转义） ---------- */
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const q = s => `'${esc(s)}'`;
const val = v => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(val).join(', ')}]`;
  return q(v);
};

const SECTION = {
  framework: 'A. 框架 / SDK / 库',
  ai: 'B. AI / LLM 机器人',
  manage: 'C. 群组 / 频道管理',
  forward: 'D. 转发 / 自动化 / Userbot',
  shop: 'E. 电商 / 商店 / Mini App',
  tool: 'F. 工具 / 文件 / 娱乐',
  growth: 'G. 营销 / 群发（高风险）',
  awesome: 'H. 资源 / 导航列表',
};

function emit(p) {
  const L = [];
  L.push(`  { id:${q(p.id)}, name:${q(p.name)}, url:${q(p.url)}, lang:${q(p.lang)}, cat:${q(p.cat)},`);
  L.push(`    desc:${q(p.desc)},`);
  L.push(`    tags:${val(p.tags)}, lic:${val(p.lic)}, licKind:${q(p.licKind)}, comm:${q(p.comm)}, maint:${q(p.maint)},`);
  if (p.src === 'api') {
    L.push('    ' + [`pushedAt:${val(p.pushedAt)}`, `stars:${val(p.stars)}`, `forks:${val(p.forks)}`, "src:'api'"].join(', ') + ',');
  }
  const tail = `    seen:${q(p.seen)}, mentions:${p.mentions}, risk:${q(p.risk)}, conf:${q(p.conf)}`;
  if (p.note) {
    L.push(tail + ',');
    L.push(`    note:${q(p.note)} },`);
  } else {
    L.push(tail + ' },');
  }
  return L.join('\n');
}

const header = `/* ============================================================
 * data.js — Telegram 开源项目数据集（共 ${baked.length} 条，已去重）
 * ------------------------------------------------------------
 * 字段说明：
 *   id          唯一标识
 *   name        owner/repo
 *   url         仓库地址
 *   lang        主要语言/技术栈
 *   cat         分类 key（见 CATEGORIES）
 *   desc        一句话功能
 *   tags        标签（用于搜索与扩展筛选）
 *   lic         许可证 SPDX（null = 无协议 / 待核实）
 *   licKind     permissive 宽松可商用 | copyleft 传染性 | unknown 未知
 *   comm        商用结论：yes 可商用 | caution 有条件 | no 不可 | unknown 待核实
 *   maint       active 活跃 | maintained 维护中 | stale 停更 | unknown 待核实
 *   seen        最近一次出现在搜索记录中的日期（真实数据）
 *   mentions    搜索历史中出现次数（真实统计）
 *   risk        normal | marketing 营销群发(违反ToS) | gambling
 *   conf        编辑字段可信度 high | medium | low
 *
 *   ── 以下字段由 bake-meta.mjs 从 GitHub API 实抓后烘焙，src:'api' 表示这些值已核实 ──
 *   pushedAt    最近一次提交日期（真实）
 *   stars       Star 数（真实）
 *   forks       Fork 数（真实）
 *   src         'api' = 该条目的许可/维护/时间/Star 来自 API 实测
 *
 * 数据可信度分布：
 *   ✅ 真实：seen / mentions（来自搜索记录）、src:'api' 条目的 lic / maint / pushedAt / stars / forks
 *   ⚠️ 推断：其余条目的 lic / maint / comm（未抓取到 API 数据，界面会标「待核实」）
 *
 * 补齐剩余仓库：node fetch-github-meta.mjs --missing && node bake-meta.mjs
 * ============================================================ */
`;

const categoriesBlock = `const CATEGORIES = {\n`
  + Object.entries(CATEGORIES).map(([k, v]) => `  ${/^[a-z]+$/.test(k) ? k : q(k)}: { label: ${q(v.label)}, color: ${q(v.color)} },`).join('\n')
  + `\n};\n\nconst LANGS = [${LANGS.map(q).join(', ')}];\n`;

let out = header + '\n' + categoriesBlock + '\nconst PROJECTS = [\n';
let lastCat = null;
baked.forEach(p => {
  if (p.cat !== lastCat) {
    out += `${lastCat ? '\n' : ''}  /* ---------- ${SECTION[p.cat] || p.cat} ---------- */\n`;
    lastCat = p.cat;
  }
  out += emit(p) + '\n';
});
out += `];\n\n/* 便于其它脚本读取 */\nif (typeof module !== 'undefined' && module.exports) {\n  module.exports = { PROJECTS, CATEGORIES, LANGS };\n}\n`;

/* ---------- 4. 往返校验 ---------- */
await writeFile('/tmp/data.baked.js', out, 'utf8');
const verifyRequire = createRequire('/tmp/x.js');
const reBaked = verifyRequire('/tmp/data.baked.js');
const ADDED = new Set(['pushedAt', 'stars', 'forks', 'src']);
const CHANGED = new Set(['lic', 'licKind', 'comm', 'maint', 'note']);   // 会被 API 真值有意覆盖的字段
const problems = [];
if (reBaked.PROJECTS.length !== baked.length) problems.push(`条目数不一致 ${baked.length} → ${reBaked.PROJECTS.length}`);
PROJECTS.forEach((orig, i) => {
  const a = reBaked.PROJECTS[i];
  if (!a) { problems.push(`#${i} 丢失`); return; }
  // 1) 不该动的字段必须原样保留
  Object.keys(orig).forEach(k => {
    if (ADDED.has(k) || CHANGED.has(k)) return;
    const same = Array.isArray(orig[k]) ? JSON.stringify(orig[k]) === JSON.stringify(a[k]) : orig[k] === a[k];
    if (!same) problems.push(`${orig.id}.${k}（编辑字段被改动）: ${JSON.stringify(orig[k])} → ${JSON.stringify(a[k])}`);
  });
  // 2) 该变的字段必须等于烘焙后的值
  const expect = baked[i];
  CHANGED.forEach(k => { if (a[k] !== expect[k]) problems.push(`${orig.id}.${k}（烘焙值不一致）: 期望 ${JSON.stringify(expect[k])} 实得 ${JSON.stringify(a[k])}`); });
  if (okMeta[orig.id]) ADDED.forEach(k => { if (a[k] !== expect[k]) problems.push(`${orig.id}.${k}（新增字段不一致）`); });
});
if (JSON.stringify(reBaked.CATEGORIES) !== JSON.stringify(CATEGORIES)) problems.push('CATEGORIES 不一致');
if (JSON.stringify(reBaked.LANGS) !== JSON.stringify(LANGS)) problems.push('LANGS 不一致');

if (problems.length) {
  console.error(`\n❌ 校验失败，共 ${problems.length} 处，未写入：`);
  problems.slice(0, 15).forEach(p => console.error('   · ' + p));
  process.exit(1);
}
console.log(`\n✅ 往返校验通过：${baked.length} 条条目、编辑字段零丢失`);

/* ---------- 5. 写入 ---------- */
if (CHECK_ONLY) { console.log('（--check 模式，未写入文件）'); process.exit(0); }
await copyFile(DATA_FILE, BAK_FILE);
await writeFile(DATA_FILE, out, 'utf8');
console.log(`✅ 已写入 data.js（备份：data.js.bak）`);
console.log(`   现在 data.js 自带 ${stats.baked} 个仓库的真实许可/维护/提交时间/Star，不依赖 meta.generated.js。`);
