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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 注意：必须用 fileURLToPath，否则路径里的空格会被编码成 %20
const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(DIR, 'data.js');
const META_FILE = path.join(DIR, 'meta.json');
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
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
  console.log(`🎯 本次抓取 ${targets.length} 个${PRIORITY ? '（按历史热度优先）' : ''}${TOKEN ? '｜已认证 5000/h' : `｜未认证，剩余配额 ${rl.remaining ?? '?'}`}`);

  const meta = { ...existing };
  let ok = 0, fail = 0, rateLimited = false;

  for (const t of targets) {
    if (rateLimited) { fail++; continue; }
    try {
      const r = await fetchRepo(t.slug);
      if (r.error) {
        console.warn(`  ✗ ${t.id.padEnd(18)} ${r.error}`);
        delete meta[t.id];
        fail++;
        if (r.error.includes('限流')) rateLimited = true;
      } else {
        meta[t.id] = r;
        console.log(`  ✓ ${t.id.padEnd(18)} pushed=${(r.pushedAt || '').slice(0, 10)} ★${r.stars} ${r.license || '无协议'}${r.archived ? ' [已归档]' : ''}`);
        ok++;
      }
    } catch (e) {
      console.warn(`  ✗ ${t.id.padEnd(18)} ${e.message}`);
      fail++;
    }
    await new Promise(r => setTimeout(r, TOKEN ? 60 : 300));
  }

  const okCount = Object.values(meta).filter(isOk).length;
  const banner = `/* meta.generated.js — 由 fetch-github-meta.mjs 自动生成
 * 生成时间：${new Date().toLocaleString()}
 * 已有真实数据：${okCount} / ${all.length} 个仓库
 */\n`;
  await writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
  await writeFile(path.join(DIR, 'meta.generated.js'), banner + 'window.GITHUB_META = ' + JSON.stringify(meta, null, 2) + ';\n', 'utf8');

  const missing = all.filter(t => !isOk(meta[t.id]));
  console.log(`\n✅ 本次成功 ${ok}，失败 ${fail}`);
  console.log(`📊 累计覆盖 ${okCount} / ${all.length} 个仓库 —— 刷新面板页面即可看到真实更新时间/Star/License。`);
  if (missing.length) {
    console.log(`\n⏳ 还剩 ${missing.length} 个未抓取。配额恢复后继续（自动跳过已完成的）：`);
    console.log(`   node fetch-github-meta.mjs --missing`);
    if (rl.reset) console.log(`   配额重置时间：${new Date(rl.reset * 1000).toLocaleString()}`);
    console.log(`   💡 更快的办法：export GITHUB_TOKEN=ghp_xxx 后一次跑完`);
  } else {
    console.log('\n🎉 全部仓库数据已补齐。');
  }
})();
