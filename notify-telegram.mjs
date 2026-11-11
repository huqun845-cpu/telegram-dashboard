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

const token = process.env.TG_BOT_TOKEN;
const chatId = process.env.TG_CHAT_ID;
const always = String(process.env.TG_NOTIFY_ALWAYS || '0') === '1';

if (!token || !chatId) {
  console.log('ℹ️  未配置 TG_BOT_TOKEN / TG_CHAT_ID，跳过 Telegram 推送');
  process.exit(0);
}
if (status === 'nochange' && !always) {
  console.log('ℹ️  数据无变化，按配置不推送（TG_NOTIFY_ALWAYS=0）');
  process.exit(0);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const now = new Date();
const stamp = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

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

/* ---------- 组装消息 ---------- */
const L = [];
const title = status === 'failed' ? '刷新失败' : status === 'nochange' ? '数据无变化' : '每日刷新完成';
L.push(`<b>Telegram 看板 · ${title}</b>`);
L.push(`<i>${esc(stamp)}</i>`);

if (status === 'nochange') {
  L.push('');
  L.push(`共 ${total} 条仓库，数据无变化，未发布。`);
} else {
  L.push('');
  L.push(`仓库 <b>${total}</b> 条 · 抓取成功 <b>${Object.keys(cur).length}</b> 个 · 失效 ${dead} 个`);
  L.push(`修正：许可证 <b>${licFix}</b> · 维护状态 <b>${maintFix}</b> · 商用结论 <b>${commFix}</b>`);
  L.push(`无 LICENSE <b>${noLic}</b> · 已归档 <b>${archived}</b>`);

  if (deltas.length) {
    L.push('');
    L.push('<b>Star 变化 Top 5</b>');
    for (const d of deltas.slice(0, 5)) {
      const sign = d.ds > 0 ? '+' : '';
      L.push(`· ${esc(d.id)} ${sign}${d.ds} → ${d.stars.toLocaleString()}${d.df ? `（fork ${d.df > 0 ? '+' : ''}${d.df}）` : ''}`);
    }
    if (deltas.length > 5) L.push(`· 其余 ${deltas.length - 5} 个仓库有波动`);
  }

  L.push('');
  L.push('<b>已发布</b>');
  L.push('GitHub Pages：https://huqun845-cpu.github.io/telegram-dashboard/');
  L.push('Surge：https://telegram-dashboard.surge.sh/');
}

const text = L.join('\n');
if (text.length > 4000) {
  console.warn('⚠️  消息过长，已截断');
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
