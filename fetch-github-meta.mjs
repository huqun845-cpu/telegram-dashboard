#!/usr/bin/env node
/* ============================================================
 * fetch-github-meta.mjs
 * 用 GitHub API 抓取每个仓库的真实元数据，覆盖「更新时间/Star/License/归档状态」
 * ------------------------------------------------------------
 * 用法：
 *   node fetch-github-meta.mjs                  # 未认证，60 次/小时（89 个仓库需分批）
 *   GITHUB_TOKEN=ghp_xxx node fetch-github-meta.mjs   # 推荐，5000 次/小时
 *   node fetch-github-meta.mjs --only aiogram,ptb     # 只抓指定 id
 *
 * 产出：
 *   meta.generated.js   （面板会自动加载，刷新页面即可看到真实数据）
 *   meta.json           （原始数据，便于其它处理）
 * ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 注意：必须用 fileURLToPath，否则路径里的空格会被编码成 %20
const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(DIR, 'data.js');
const META_FILE = path.join(DIR, 'meta.json');
/**
 * token 解析顺序：环境变量优先，其次自动向 gh CLI 要。
 * 必须自动兜底 —— 直接手跑 `node fetch-github-meta.mjs` 时若忘了 export，
 * 未认证配额只有 60/小时，抓到一半就限流，剩下的仓库会被当成「抓取失败」。
 */
function resolveToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (fromEnv) return fromEnv;
  try {
    return execSync('gh auth token', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { return ''; }
}
const TOKEN = resolveToken();
const TOKEN_SRC = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) ? 'env' : (TOKEN ? 'gh CLI' : '无');
const argv = process.argv.slice(2);
const flag = (name) => argv.find(a => a === name || a.startsWith(name + '='));
const ONLY = (() => { const a = flag('--only'); return a && a.includes('=') ? a.split('=')[1].split(',').map(s => s.trim()) : null; })();
const MISSING_ONLY = !!flag('--missing');           // 只抓还没有成功结果的（增量续跑）
const PRIORITY = !flag('--no-priority');            // 按历史热度排序，先抓最有价值的
const LIMIT = (() => { const a = flag('--limit'); return a && a.includes('=') ? +a.split('=')[1] : Infinity; })();

/* ---------- 许可证归类 ---------- */
const PERMISSIVE = ['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'unlicense', '0bsd', 'wtfpl', 'zlib', 'bsl-1.0', 'cc0-1.0'];
const COPYLEFT = ['gpl-2.0', 'gpl-3.0', 'agpl-3.0', 'lgpl-2.1', 'lgpl-3.0', 'mpl-2.0', 'eupl-1.2', 'sspl-1.0', 'osl-3.0'];
function kindOf(spdx) {
  if (!spdx) return 'unknown';
  const s = String(spdx).toLowerCase();
  if (PERMISSIVE.includes(s)) return 'permissive';
  if (COPYLEFT.includes(s)) return 'copyleft';
  return 'unknown';
}

/* ---------- 从 data.js 里抽取 id + url + mentions ---------- */
async function extractTargets() {
  const src = await readFile(DATA_FILE, 'utf8');
  const re = /id:\s*'([^']+)'[\s\S]*?url:\s*'(https:\/\/github\.com\/[^']+)'[\s\S]*?mentions:\s*(\d+)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const [, id, url, mentions] = m;
    const slug = url.replace('https://github.com/', '').replace(/\/$/, '');
    if (!slug.includes('/')) continue;
    out.push({ id, slug, url, mentions: +mentions });
  }
  if (PRIORITY) out.sort((a, b) => b.mentions - a.mentions);
  return out;
}

/* ---------- 读取已有结果（支持增量续跑） ---------- */
async function loadExisting() {
  try { return JSON.parse(await readFile(META_FILE, 'utf8')); } catch { return {}; }
}
const isOk = (v) => v && !v.error;

/* ---------- 抓取单个仓库 ---------- */
async function fetchRepo(slug) {
  const res = await fetch(`https://api.github.com/repos/${slug}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'tg-open-source-dashboard',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });

  if (res.status === 404) return { error: '仓库不存在或已改名' };
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    return { error: `触发限流（重置时间 ${reset ? new Date(reset * 1000).toLocaleString() : '未知'}），请设置 GITHUB_TOKEN 后重试` };
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };

  const j = await res.json();
  const spdx = j.license?.spdx_id && j.license.spdx_id !== 'NOASSERTION' ? j.license.spdx_id : null;
  return {
    pushedAt: j.pushed_at,
    updatedAt: j.updated_at,
    createdAt: j.created_at,
    stars: j.stargazers_count,
    forks: j.forks_count,
    openIssues: j.open_issues_count,
    license: spdx,
    licenseKind: kindOf(spdx),
    archived: !!j.archived,
    disabled: !!j.disabled,
    homepage: j.homepage || null,
    description: j.description || null,
    topics: j.topics || [],
    defaultBranch: j.default_branch,
  };
}

/* ---------- 查配额 ---------- */
async function rateLimit() {
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { 'User-Agent': 'tg-open-source-dashboard', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    });
    const j = await res.json();
    return { remaining: j.resources.core.remaining, reset: j.resources.core.reset };
  } catch { return { remaining: null, reset: null }; }
}

/* ---------- 主流程 ---------- */
(async () => {
  const all = await extractTargets();
  const existing = await loadExisting();

  let targets = ONLY ? all.filter(t => ONLY.includes(t.id)) : all;
  if (MISSING_ONLY) targets = targets.filter(t => !isOk(existing[t.id]));
  targets = targets.slice(0, LIMIT);

  const rl = await rateLimit();
  console.log(`📦 data.js 共 ${all.length} 个仓库，已有真实数据 ${Object.values(existing).filter(isOk).length} 个`);
  console.log(`🎯 本次抓取 ${targets.length} 个${PRIORITY ? '（按历史热度优先）' : ''}${TOKEN ? `｜已认证 5000/h（token 来自 ${TOKEN_SRC}）` : `｜⚠️  未认证，剩余配额 ${rl.remaining ?? '?'}，抓不完会被限流`}`);

  const meta = { ...existing };
  let ok = 0, fail = 0, kept = 0, rateLimited = false;
  const dead = new Set();   // 404：仓库已删除/改名，不再计入「待抓取」

  for (const t of targets) {
    if (rateLimited) { fail++; continue; }
    try {
      const r = await fetchRepo(t.slug);
      if (r.error) {
        console.warn(`  ✗ ${t.id.padEnd(18)} ${r.error}`);
        if (r.error.includes('不存在')) {
          // 仓库真的没了，清掉（否则面板会一直显示一份查无此人的数据）
          delete meta[t.id];
          dead.add(t.id);
        } else if (isOk(existing[t.id])) {
          // 限流/网络抖动/5xx 属于「本次没问到」，不该把上次抓到的好数据抹掉
          kept++;
          console.warn(`      ↳ 保留上次抓到的数据（${String(existing[t.id].pushedAt).slice(0, 10)}），本次不更新`);
        } else {
          delete meta[t.id];
        }
        fail++;
        if (r.error.includes('限流')) rateLimited = true;
      } else {
        meta[t.id] = r;
        console.log(`  ✓ ${t.id.padEnd(18)} pushed=${(r.pushedAt || '').slice(0, 10)} ★${r.stars} ${r.license || '无协议'}${r.archived ? ' [已归档]' : ''}`);
        ok++;
      }
    } catch (e) {
      console.warn(`  ✗ ${t.id.padEnd(18)} ${e.message}`);
      if (isOk(existing[t.id])) { kept++; console.warn('      ↳ 保留上次抓到的数据'); }
      fail++;
    }
    await new Promise(r => setTimeout(r, TOKEN ? 60 : 300));
  }

  const okCount = Object.values(meta).filter(isOk).length;
  // 刻意不放「生成时间」：每次跑都变的横幅会让 meta.generated.js 永远处于
  // 「已修改」状态，refresh.sh 的「数据无变化就不发布」判断会因此永久失效。
  // 改用数据自身派生的信息，内容没变则文件字节完全一致。
  const dates = Object.values(meta).filter(isOk).map(v => v.pushedAt).filter(Boolean).sort();
  const banner = `/* meta.generated.js — 由 fetch-github-meta.mjs 自动生成
 * 已有真实数据：${okCount} / ${all.length} 个仓库
 * 最新一次提交时间：${dates.at(-1) || '—'}
 */\n`;
  await writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
  await writeFile(path.join(DIR, 'meta.generated.js'), banner + 'window.GITHUB_META = ' + JSON.stringify(meta, null, 2) + ';\n', 'utf8');

  // 已 404 的仓库不算「待抓取」，否则每天都会提示一个永远抓不到的仓库
  const missing = all.filter(t => !isOk(meta[t.id]) && !dead.has(t.id));
  console.log(`\n✅ 本次成功 ${ok}，失败 ${fail}${kept ? `（其中 ${kept} 个为瞬时失败，已保留上次数据）` : ''}`);
  console.log(`📊 累计覆盖 ${okCount} / ${all.length} 个仓库 —— 刷新面板页面即可看到真实更新时间/Star/License。`);
  if (dead.size) {
    console.log(`\n🚫 ${dead.size} 个仓库已失效（GitHub 返回 404，仓库被删或改名），不再重试：`);
    console.log(`   ${[...dead].join(', ')}`);
    console.log(`   → 面板里这些条目已标注「仓库已不存在」`);
  }
  if (missing.length) {
    console.log(`\n⏳ 还剩 ${missing.length} 个未抓取。配额恢复后继续（自动跳过已完成的）：`);
    console.log(`   node fetch-github-meta.mjs --missing`);
    if (rl.reset) console.log(`   配额重置时间：${new Date(rl.reset * 1000).toLocaleString()}`);
    console.log(`   💡 更快的办法：export GITHUB_TOKEN=ghp_xxx 后一次跑完`);
  } else if (!dead.size) {
    console.log('\n🎉 全部仓库数据已补齐。');
  } else {
    console.log(`\n🎉 其余 ${all.length - dead.size} 个仓库数据已全部补齐。`);
  }
})();
