/* 每日 Star 快照：给看板提供「趋势」维度，而不只是当前数字
 *
 *   history.json   原始数据，每天一条 {d:'2026-11-06', s:{仓库id: star数}}
 *   history.js     同一个数据包成 window.STAR_HISTORY，供 index.html 直接引入
 *                  （用 js 而不是 json，是为了保留 file:// 双击直开的能力）
 *
 * 设计要点：
 *   - 同一天重复跑会覆盖当天记录，不会追加重复点
 *   - 只保留最近 90 天，避免仓库无限膨胀
 *   - 死链仓库（meta 里没有）自动跳过
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = process.env.TG_DIR || path.dirname(fileURLToPath(import.meta.url));
const KEEP_DAYS = 90;
const today = new Date().toISOString().slice(0, 10);

const metaPath = `${DIR}/meta.json`;
const histPath = `${DIR}/history.json`;
if (!fs.existsSync(metaPath)) {
  console.error('❌ 找不到 meta.json，先跑 fetch-github-meta.mjs');
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
let hist = [];
if (fs.existsSync(histPath)) {
  try {
    hist = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    if (!Array.isArray(hist)) hist = [];
  } catch {
    console.warn('⚠️  history.json 解析失败，重新开始记录');
    hist = [];
  }
}

const snap = {};
for (const [id, m] of Object.entries(meta)) {
  if (m && typeof m.stars === 'number') snap[id] = m.stars;
}

// 当天已有记录就覆盖（同一天多次刷新只留最后一次）
const idx = hist.findIndex(h => h && h.d === today);
const rec = { d: today, s: snap };
if (idx >= 0) hist[idx] = rec;
else hist.push(rec);

hist.sort((a, b) => String(a.d).localeCompare(String(b.d)));
hist = hist.slice(-KEEP_DAYS);

fs.writeFileSync(histPath, JSON.stringify(hist) + '\n');
fs.writeFileSync(`${DIR}/history.js`, 'window.STAR_HISTORY=' + JSON.stringify(hist) + ';\n');

console.log(`📈 Star 快照：今天 ${today}，覆盖 ${Object.keys(snap).length} 个仓库，累计 ${hist.length} 天（最多保留 ${KEEP_DAYS} 天）`);
