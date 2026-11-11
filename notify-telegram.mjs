/* 每日刷新结果推送到 Telegram 频道
 *
 * 凭据不放在仓库里（仓库是公开的，且 Surge 会整目录上传）：
 *   ~/.config/tg-dashboard/notify.env  (chmod 600)
 *   TG_BOT_TOKEN=...
 *   TG_CHAT_ID=-100...
 *   TG_NOTIFY_ALWAYS=0   # 1 = 数据无变化也推送
 *
 * 用法：node notify-telegram.mjs published|nochange|failed
 * 设计原则：推送失败只告警，绝不影响已经完成的发布。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PREV = '/tmp/tg_prev_meta.json';
const BAKE_LOG = '/tmp/tg_bake.log';
const status = process.argv[2] || 'published';
const DRY = process.argv.includes('--dry-run') || String(process.env.TG_DRY_RUN || '') === '1';

const token = process.env.TG_BOT_TOKEN;
const chatId = process.env.TG_CHAT_ID;
const always = String(process.env.TG_NOTIFY_ALWAYS || '0') === '1';

if (!token || !chatId) {
  if (!DRY) {
    console.log('ℹ️  未配置 TG_BOT_TOKEN / TG_CHAT_ID，跳过 Telegram 推送');
    process.exit(0);
  }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const now = new Date();
const stamp = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const dateStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

/* ---------- 数据对比 ---------- */
function flatMeta(obj) {
  const out = {};
  const walk = d => {
    for (const [k, v] of Object.entries(d || {})) {
      if (v && typeof v === 'object') {
        if ('stars' in v) out[k] = v;
        else walk(v);
      }
    }
  };
  walk(obj);
  return out;
}
let cur = {}, prev = {};
try { cur = flatMeta(JSON.parse(fs.readFileSync(path.join(DIR, 'meta.json'), 'utf8'))); } catch {}
try { prev = flatMeta(JSON.parse(fs.readFileSync(PREV, 'utf8'))); } catch {}

const deltas = [];
for (const [id, m] of Object.entries(cur)) {
  if (!prev[id]) continue;
  const ds = (m.stars || 0) - (prev[id].stars || 0);
  const df = (m.forks || 0) - (prev[id].forks || 0);
  if (ds || df) deltas.push({ id, stars: m.stars || 0, ds, df });
}
deltas.sort((a, b) => b.ds - a.ds);

/* ---------- 烘焙统计 ---------- */
let bake = '';
try { bake = fs.readFileSync(BAKE_LOG, 'utf8'); } catch {}
const pick = re => (bake.match(re) || [])[1] || '0';
const total = pick(/烘焙\s*(\d+)\s*条/) || String(Object.keys(cur).length);
const licFix = pick(/许可证修正\s*(\d+)/);
const maintFix = pick(/维护状态修正\s*(\d+)/);
const commFix = pick(/商用结论修正\s*(\d+)/);
const noLic = pick(/无协议\s*(\d+)/);
const archived = pick(/已归档\s*(\d+)/);
const deadMatch = bake.match(/失效仓库\s*(\d+)\s*个/);
const dead = deadMatch ? deadMatch[1] : '0';

/* ---------- 结构变化明细（bake-meta 落盘） ---------- */
let details = { lic: [], maint: [], comm: [], archived: [], dead: [] };
let changeTotal = null;
try {
  const cf = JSON.parse(fs.readFileSync('/tmp/tg_changes.json', 'utf8'));
  if (cf && cf.details) details = { ...details, ...cf.details };
  if (cf && cf.total) changeTotal = cf.total;
} catch { /* 没有明细文件时退化为只报个数 */ }

// 兜底：用 prev/cur 差异补许可证与归档变化（老版本 bake 不产明细时）
if (!details.lic.length) {
  for (const [id, m] of Object.entries(cur)) {
    const o = prev[id];
    if (o && (o.license || null) !== (m.license || null)) details.lic.push({ id, from: o.license || null, to: m.license || null });
  }
}
if (!details.archived.length) {
  for (const [id, m] of Object.entries(cur)) {
    if (m.archived && prev[id] && !prev[id].archived) details.archived.push({ id });
  }
}

const structural = details.lic.length + details.maint.length + details.comm.length + details.archived.length;

/* ---------- 模式判定：没结构变化就不打扰 ---------- */
const isMonday = now.getDay() === 1;
let mode = status === 'failed' ? 'failed'
  : status === 'nochange' ? 'silent'
  : structural > 0 ? 'daily'
  : isMonday ? 'weekly' : 'silent';
if (status === 'published' && always) mode = structural > 0 ? 'daily' : 'weekly';
// 预览用：TG_FORCE_MODE=daily|weekly|silent|failed
if (process.env.TG_FORCE_MODE) mode = process.env.TG_FORCE_MODE;

if (mode === 'silent') {
  console.log(`ℹ️  无结构性变化（Star 波动 ${deltas.length} 个），不推送；仅在页面更新。`);
  process.exit(0);
}

/* ---------- 周报：用 history.json 算区间增长 ---------- */
function weekDeltas() {
  try {
    const hist = JSON.parse(fs.readFileSync(path.join(DIR, 'history.json'), 'utf8'));
    if (!Array.isArray(hist) || hist.length < 2) return { list: [], days: 0 };
    const first = hist[0].s || {}, last = hist[hist.length - 1].s || {};
    const days = Math.max(1, Math.round((Date.parse(hist[hist.length - 1].d) - Date.parse(hist[0].d)) / 86400000));
    const list = Object.entries(last)
      .map(([id, st]) => ({ id, stars: st, ds: st - (first[id] ?? st) }))
      .filter(x => x.ds);
    list.sort((a, b) => b.ds - a.ds);
    return { list, days };
  } catch { return { list: [], days: 0 }; }
}

/* ---------- 组装消息 ---------- */
const IMPACT = {
  maint: { active: '近 90 天有提交，可重新纳入候选', maintained: '提交变慢，降级观察', stale: '长期无提交，按停更处理' },
};
const impactOf = (kind, to) => {
  if (kind === 'maint') return IMPACT.maint[to] || '维护等级变化，需复核';
  if (kind === 'lic') return to ? `许可证改为 ${to}，商用前核对该许可条款` : '无 LICENSE：法律上默认保留所有权利，商用前需授权';
  if (kind === 'comm') return '商用结论变化，选型建议需同步更新';
  if (kind === 'archived') return '作者已归档，停止选型';
  return '';
};

const L = [];
if (mode === 'failed') {
  L.push(`❗️ <b>看板刷新失败</b>`);
  L.push(`<i>${esc(stamp)}</i>`);
  L.push('');
  L.push('线上保留上一版数据，未被覆盖。');
  L.push('排查顺序：抓取（gh token）→ 烘焙 → 测试 → 发布。');
  L.push('日志：<code>/tmp/tg_bake.log</code>');
} else if (mode === 'weekly') {
  const { list, days } = weekDeltas();
  L.push(`📊 <b>看板周报 · ${dateStr}</b>`);
  L.push(`<i>${days || 7} 天区间 · ${Object.keys(cur).length} 个仓库</i>`);
  L.push('');
  if (list.length) {
    L.push(`<b>Star 增长 Top 5</b>`);
    for (const d of list.slice(0, 5)) {
      L.push(`· ${esc(d.id)}　+${d.ds.toLocaleString()} → ${d.stars.toLocaleString()}`);
    }
  } else {
    L.push('区间内 Star 无变化。');
  }
  L.push('');
  L.push('本周无许可证 / 归档 / 维护等级变化。');
  L.push('');
  L.push('<b>已发布</b>');
  L.push('GitHub Pages：https://huqun845-cpu.github.io/telegram-dashboard/');
  L.push('Surge：https://telegram-dashboard.surge.sh/');
} else {
  L.push(`🗂 <b>看板日报 · ${dateStr}</b>`);
  L.push(`<i>${changeTotal || total} 个仓库 · ${Object.keys(cur).length} 正常 · ${dead} 失联</i>`);
  L.push('');

  const groups = [
    ['lic', '许可证变化'],
    ['maint', '维护状态变化'],
    ['comm', '商用结论变化'],
    ['archived', '新增归档'],
  ];
  L.push(`<b>结构变化 ${structural + details.dead.length} 条</b>`);
  let shown = 0;
  for (const [kind, label] of groups) {
    for (const c of details[kind] || []) {
      if (shown++ >= 8) break;
      const from = c.from || '—', to = c.to || '—';
      L.push(`• <b>${esc(c.id)}</b>　${label.replace('变化', '')} <code>${esc(from)}</code> → <code>${esc(to)}</code>`);
      L.push(`　→ ${esc(impactOf(kind, c.to))}`);
    }
  }
  if (details.dead.length) {
    const ids = details.dead.slice(0, 6).map(esc).join('、');
    L.push(`• <b>失联</b>　${ids}${details.dead.length > 6 ? ` 等 ${details.dead.length} 个` : ''}`);
    L.push('　→ GitHub 返回 404，已从看板移除，历史快照保留');
  }
  if (shown + details.dead.length > 9) L.push(`· 其余 ${shown + details.dead.length - 9} 条见页面`);

  L.push('');
  L.push('<b>风险台账</b>');
  L.push(`无 LICENSE ${noLic} · 已归档 ${archived} · 失效 ${dead}`);
  L.push('');
  L.push('<b>已发布</b>');
  L.push('GitHub Pages：https://huqun845-cpu.github.io/telegram-dashboard/');
  L.push('Surge：https://telegram-dashboard.surge.sh/');
}

const text = L.join('\n');
if (text.length > 4000) {
  console.warn('⚠️  消息过长，已截断');
}
if (DRY) {
  console.log('----- DRY RUN -----');
  console.log(text);
  console.log('----- /DRY RUN -----');
  process.exit(0);
}

/* ---------- 发送 ---------- */
try {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4000),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`⚠️  Telegram 推送失败：${data.description || res.status}`);
    process.exit(0); // 不阻塞发布流程
  }
  console.log(`📨 Telegram 已推送（message_id=${data.result.message_id}）`);
} catch (e) {
  console.error(`⚠️  Telegram 推送异常：${e.message}`);
  process.exit(0);
}
