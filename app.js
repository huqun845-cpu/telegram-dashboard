/* ============================================================
 * app.js — Telegram 开源项目洞察面板
 * 零依赖 · 纯静态 · 图表为手写 SVG + CSS
 * ------------------------------------------------------------
 * 功能：多维筛选 / 可视化图表 / 详情抽屉 / 智能预设
 *       ▸ 选型评分（可调权重）      ▸ 项目并排对比
 *       ▸ 收藏夹 + 调研笔记         ▸ 采集器（文本提取 / GitHub 搜索）
 * ============================================================ */
'use strict';

/* ============================================================
 * 0. 常量
 * ============================================================ */
const K = { favs: 'tg.favs', notes: 'tg.notes', custom: 'tg.custom', cand: 'tg.cand', w: 'tg.w', scen: 'tg.scenario', theme: 'tg.theme' };

const COMM_LABEL = { yes: '可商用 ✓', caution: '有条件 ⚠', no: '不建议 ✕', unknown: '待核实 ?' };
const COMM_CLASS = { yes: 'b-ok', caution: 'b-warn', no: 'b-dang', unknown: 'b-mute' };
const MAINT_LABEL = { active: '活跃', maintained: '维护中', stale: '停更', unknown: '待核实' };
const MAINT_CLASS = { active: 'b-ok', maintained: 'b-conf', stale: 'b-dang', unknown: 'b-mute' };
const LICKIND_LABEL = { permissive: '宽松许可', copyleft: '传染性许可', unknown: '未知/无协议' };
const LICKIND_COLOR = { permissive: '#22c8a0', copyleft: '#f5a524', unknown: '#69768d' };
const RISK_LABEL = { normal: '正常', marketing: '营销群发', gambling: '赌博' };
const LANG_COLORS = ['#4f8cff', '#22c8a0', '#a06bff', '#f5a524', '#ff6b9d', '#38bdf8', '#ff5d5d', '#8a94a6', '#7dd3fc'];

/* 选型场景 */
const SCENARIOS = {
  all:       { label: '不限（按历史热度）', match: () => true },
  shop:      { label: '🛍 Mini App / 电商',  match: p => p.cat === 'shop' },
  channel:   { label: '📢 频道内容运营',     match: p => p.cat === 'manage' || p.cat === 'forward' },
  forward:   { label: '🔁 转发 / RSS 同步',  match: p => p.cat === 'forward' },
  ai:        { label: '🤖 AI 机器人',        match: p => p.cat === 'ai' },
  framework: { label: '🧱 Bot 开发框架',     match: p => p.cat === 'framework' },
  group:     { label: '👥 群组管理',         match: p => p.cat === 'manage' },
  tool:      { label: '🧰 工具 / 文件',      match: p => p.cat === 'tool' },
  awesome:   { label: '📚 资源导航',         match: p => p.cat === 'awesome' },
};

/** 手动标记的中文友好项目（有中文 README / 中文作者的） */
const ZH_IDS = new Set(['tgstate', 'lobsterai', 'tempemail', 'chanadmin', 'chanmgr', 'autotg',
  'musebot', 'itgoyo', 'duannai', 'hashbac']);

/* 从描述/话题猜分类（采集器用）
 * 顺序很关键：越"专属"的特征词越靠前。
 * 例如「A telegram bot framework with mini app support」应判为框架而不是商城。 */
const CAT_HINTS = [
  ['awesome',   /awesome|curated|collection|导航|合集|大全|list of/i],
  ['framework', /framework|sdk|bot ?api|librar|wrapper|scaffold|boilerplate|template|脚手架|框架|封装/i],
  ['growth',    /bulk|mass ?dm|sender|marketing|member adder|autoreg|spam|群发|拉人|营销|加粉/i],
  ['forward',   /forward|rss|sync|clone|mirror|autopost|relay|转发|同步|克隆/i],
  ['manage',    /(group|channel|chat)[ _-]?(admin|manage|moderat)|moderation|antispam|anti-spam|captcha|welcome|群管|频道管理|审核|去重|后台/i],
  ['shop',      /mini ?app|store|shop|cart|commerce|woocommerce|checkout|payment|digital goods|电商|商城|商店|发卡/i],
  ['ai',        /gpt|llm|openai|deepseek|claude|gemini|ollama|chatbot|agent|rag|prompt|智能|对话/i],
  ['tool',      /scraper|download|upload|storage|file|backup|utility|tool|工具|外链|临时|爬虫/i],
];
function guessCat(text) {
  for (const [cat, re] of CAT_HINTS) if (re.test(text)) return cat;
  return 'tool';
}

/* ============================================================
 * 1. 本地存储 + 数据增强
 * ============================================================ */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式忽略 */ } },
};

const META = (typeof window.GITHUB_META === 'object' && window.GITHUB_META) || {};
const FAVS = new Set(store.get(K.favs, []));
const NOTES = store.get(K.notes, {});
const CUSTOM = store.get(K.custom, []);      // 已并入面板的采集项目
const CANDS = store.get(K.cand, []);         // 候选池（尚未并入）
const WEIGHTS = Object.assign({ lic: 3, zh: 2, act: 3, rel: 2 }, store.get(K.w, {}));

const daysAgo = d => Math.round((new Date() - new Date(String(d).slice(0, 10) + 'T00:00:00')) / 86400000);
function maintFromDays(d) { return d <= 90 ? 'active' : d <= 365 ? 'maintained' : 'stale'; }

/** 把原始条目补全成面板使用的对象
 *  数据优先级：meta.generated.js（最新） > data.js 里烘焙的值（bake-meta.mjs） > 推断值 */
function enhance(p) {
  const m = META[p.id] || null;
  const o = Object.assign({}, p);
  o.custom = !!p.custom;
  o.baked = p.src === 'api';                    // data.js 里已烘焙 API 真值
  o.pushed = m && m.pushedAt ? String(m.pushedAt).slice(0, 10) : (p.pushedAt || null);
  o.stars = m && typeof m.stars === 'number' ? m.stars : (typeof p.stars === 'number' ? p.stars : null);
  o.forks = m && typeof m.forks === 'number' ? m.forks : (typeof p.forks === 'number' ? p.forks : null);
  o.openIssues = m && typeof m.openIssues === 'number' ? m.openIssues : null;
  o.hasApi = !!m || o.baked;
  o.days = o.pushed ? daysAgo(o.pushed) : null;

  // 真实 API 数据优先，覆盖推断值
  if (m) {
    if (m.license) o.lic = m.license;
    if (m.licenseKind) o.licKind = m.licenseKind;
    if (m.pushedAt) o.maint = maintFromDays(o.days);
  }
  if (m && m.archived) {
    o.maint = 'stale';
    if (!/已归档/.test(o.note || '')) o.note = (o.note ? o.note + '；' : '') + '仓库已归档（archived）';
  }
  // 烘焙过的条目：maint 已在 data.js 里按真实提交时间写好，这里只兜底
  if (!m && o.baked && o.days != null) o.maint = maintFromDays(o.days);
  if (o.lic && !m) o.licKind = o.licKind || 'unknown';
  if (o.licKind === 'unknown' && o.lic) {
    const s = String(o.lic).toLowerCase();
    if (/^(mit|apache|bsd|isc|unlicense|0bsd|cc0)/.test(s)) o.licKind = 'permissive';
    else if (/gpl/.test(s)) o.licKind = 'copyleft';
  }
  if (p.comm !== 'no') {
    o.comm = o.licKind === 'permissive' ? 'yes' : o.licKind === 'copyleft' ? 'caution' : o.comm;
  }

  // 中文友好：只看「名字里有中文」或「标签里带中文」，不能用描述判断
  //（描述全是中文写的，否则会 100% 命中）
  const zhHay = (o.name + ' ' + (o.tags || []).join(' ')).toLowerCase();
  o.zh = (ZH_IDS.has(o.id) || /[\u4e00-\u9fa5]/.test(o.name) || /中文/.test(zhHay)) ? 'yes' : 'no';

  o.verified = o.conf === 'high' || o.hasApi;
  o.isFav = FAVS.has(o.id);
  o.note_text = NOTES[o.id] || '';
  return o;
}

const DATA = PROJECTS.concat(CUSTOM).map(enhance);

/* ============================================================
 * 2. 选型评分
 * ============================================================ */
function activityScore(p) {
  if (p.days != null) {
    const d = p.days;
    if (d <= 30) return 1;
    if (d <= 90) return 0.85;
    if (d <= 180) return 0.7;
    if (d <= 365) return 0.5;
    return 0.15;
  }
  return { active: 0.85, maintained: 0.6, unknown: 0.4, stale: 0.1 }[p.maint] ?? 0.4;
}
function heatScore(p) { return Math.min(1, 0.4 + p.mentions * 0.12); }

function scoreOf(p) {
  const w = state.w;
  const lic = { yes: 1, caution: 0.6, unknown: 0.35, no: 0 }[p.comm] ?? 0.35;
  const zh = p.zh === 'yes' ? 1 : 0.15;
  const act = activityScore(p);
  const rel = state.scenario === 'all' ? heatScore(p)
    : (SCENARIOS[state.scenario].match(p) ? 1 : 0.15);
  const tot = (w.lic + w.zh + w.act + w.rel) || 1;
  const raw = (w.lic * lic + w.zh * zh + w.act * act + w.rel * rel) / tot;
  return { total: Math.round(raw * 100), lic: Math.round(lic * 100), zh: Math.round(zh * 100), act: Math.round(act * 100), rel: Math.round(rel * 100) };
}
function scoreClass(n) { return n >= 75 ? 'b-ok' : n >= 55 ? 'b-conf' : n >= 40 ? 'b-warn' : 'b-dang'; }

/* ============================================================
 * 3. 状态
 * ============================================================ */
const state = {
  q: '', cats: new Set(), langs: new Set(), comms: new Set(), licKinds: new Set(),
  maints: new Set(), risks: new Set(), zhs: new Set(), fresh: 'all',
  minMentions: 0, excludeRisk: false, favOnly: false, noteOnly: false, verifiedOnly: false,
  sort: 'score', view: 'card', mode: 'all',
  scenario: store.get(K.scen, 'all'), w: WEIGHTS,
  compare: new Set(),
};

/* ============================================================
 * 4. 筛选器定义
 * ============================================================ */
const FRESH_OPTIONS = [['all', '全部'], ['d30', '近 30 天'], ['d90', '近 90 天'], ['y1', '近 1 年'], ['has', '有提交日期'], ['none', '日期待核实']];

const GROUPS = [
  { key: 'cats', title: '分类', field: 'cat', source: () => Object.keys(CATEGORIES).map(k => [k, CATEGORIES[k].label, CATEGORIES[k].color]) },
  { key: 'langs', title: '技术栈', field: 'lang', source: () => [...new Set(DATA.map(p => p.lang))].sort().map(k => [k, k, null]) },
  { key: 'comms', title: '商用友好度', field: 'comm', source: () => Object.keys(COMM_LABEL).map(k => [k, COMM_LABEL[k], k === 'yes' ? '#22c8a0' : k === 'caution' ? '#f5a524' : k === 'no' ? '#ff5d5d' : '#69768d']) },
  { key: 'licKinds', title: '许可证类型', field: 'licKind', source: () => Object.keys(LICKIND_LABEL).map(k => [k, LICKIND_LABEL[k], LICKIND_COLOR[k]]) },
  { key: 'maints', title: '维护状态', field: 'maint', source: () => Object.keys(MAINT_LABEL).map(k => [k, MAINT_LABEL[k], k === 'active' ? '#22c8a0' : k === 'maintained' ? '#4f8cff' : k === 'stale' ? '#ff5d5d' : '#69768d']) },
  { key: 'zhs', title: '中文友好', field: 'zh', source: () => [['yes', '中文文档 / 中文社区', '#22c8a0'], ['no', '仅英文', '#69768d']] },
  { key: 'risks', title: '风险等级', field: 'risk', source: () => Object.keys(RISK_LABEL).map(k => [k, RISK_LABEL[k], k === 'normal' ? '#22c8a0' : k === 'marketing' ? '#f5a524' : '#ff5d5d']) },
];

/* 智能预设 */
const PRESETS = {
  prod: { label: '生产级首选', desc: '近 90 天有提交 ∧ 宽松许可 ∧ 活跃', run() { resetFilters(); state.fresh = 'd90'; state.licKinds = new Set(['permissive']); state.maints = new Set(['active']); state.sort = 'score'; } },
  commercial: { label: '商用安全', desc: '可商用 ∧ 无风险', run() { resetFilters(); state.comms = new Set(['yes']); state.excludeRisk = true; } },
  commercialActive: { label: '商用且维护中', desc: '可商用 ∧ 近半年有提交', run() { resetFilters(); state.comms = new Set(['yes']); state.fresh = 'd90'; state.maints = new Set(['active']); } },
  miniapp: { label: 'Mini App 电商', desc: '可直接部署的商城', run() { resetFilters(); state.cats = new Set(['shop']); state.sort = 'score'; } },
  chinese: { label: '中文友好', desc: '中文文档 / 中文社区', run() { resetFilters(); state.zhs = new Set(['yes']); } },
  hot: { label: '高热度', desc: '历史出现 ≥3 次', run() { resetFilters(); state.minMentions = 3; } },
  starred: { label: '有 Star 且活跃', desc: '星级 + 近 90 天提交', run() { resetFilters(); state.fresh = 'd90'; state.sort = 'stars'; } },
};

/* ============================================================
 * 5. 工具
 * ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDays = d => d == null ? '—' : d < 0 ? '刚刚' : d < 30 ? d + ' 天前' : d < 365 ? Math.round(d / 30) + ' 个月前' : (d / 365).toFixed(1) + ' 年前';

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg || '已复制到剪贴板');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(okMsg || '已复制到剪贴板'); }
    catch (_) { toast('复制失败，请手动选择文本'); }
    ta.remove();
  }
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }

/* ============================================================
 * 6. 过滤 / 排序
 * ============================================================ */
function pass(p) {
  if (state.mode === 'fav' && !FAVS.has(p.id)) return false;
  if (state.q) {
    const hay = (p.name + ' ' + p.desc + ' ' + p.tags.join(' ') + ' ' + p.lang + ' ' + p.lic + ' ' + p.id + ' ' + p.note_text).toLowerCase();
    if (!hay.includes(state.q.toLowerCase())) return false;
  }
  for (const g of GROUPS) if (state[g.key].size && !state[g.key].has(String(p[g.field]))) return false;
  if (state.excludeRisk && p.risk !== 'normal') return false;
  if (p.mentions < state.minMentions) return false;
  if (state.favOnly && !FAVS.has(p.id)) return false;
  if (state.noteOnly && !p.note_text.trim()) return false;
  if (state.verifiedOnly && !p.verified) return false;
  if (state.fresh !== 'all') {
    if (state.fresh === 'has' && !p.pushed) return false;
    if (state.fresh === 'none' && p.pushed) return false;
    if (state.fresh === 'd30' && !(p.days != null && p.days <= 30)) return false;
    if (state.fresh === 'd90' && !(p.days != null && p.days <= 90)) return false;
    if (state.fresh === 'y1' && !(p.days != null && p.days <= 365)) return false;
  }
  return true;
}
function sorted(list) {
  const s = state.sort;
  return list.slice().sort((a, b) => {
    if (s === 'name') return a.name.localeCompare(b.name);
    if (s === 'cat') return a.cat.localeCompare(b.cat) || b.mentions - a.mentions;
    if (s === 'seen') return (b.seen || '').localeCompare(a.seen || '');
    if (s === 'pushed') return (b.pushed || '').localeCompare(a.pushed || '');
    if (s === 'stars') return (b.stars ?? -1) - (a.stars ?? -1) || b.mentions - a.mentions;
    if (s === 'score') return scoreOf(b).total - scoreOf(a).total || b.mentions - a.mentions;
    return b.mentions - a.mentions || a.name.localeCompare(b.name);
  });
}
const currentList = () => sorted(DATA.filter(pass));

function resetFilters() {
  Object.assign(state, {
    q: '', cats: new Set(), langs: new Set(), comms: new Set(), licKinds: new Set(),
    maints: new Set(), risks: new Set(), zhs: new Set(), fresh: 'all',
    minMentions: 0, excludeRisk: false, favOnly: false, noteOnly: false, verifiedOnly: false,
  });
  $('#search').value = '';
  ['excludeRisk', 'favOnly', 'noteOnly', 'verifiedOnly'].forEach(id => $('#' + id).checked = false);
  $('#minMentions').value = 0; $('#minMentionsVal').textContent = '0';
}
function resetAll() { resetFilters(); state.mode = 'all'; state.view = 'card'; state.sort = 'score'; state.compare.clear(); render(); }

/* ============================================================
 * 7. 渲染：侧边栏
 * ============================================================ */
function renderFilters() {
  $('#filterGroups').innerHTML = GROUPS.map(g => {
    const opts = g.source().map(([val, label, color]) => {
      const cnt = DATA.filter(p => String(p[g.field]) === String(val)).length;
      const on = state[g.key].has(String(val));
      return `<label class="chk ${on ? 'on' : ''}">
        ${color ? `<i class="dot" style="background:${color}"></i>` : ''}
        <input type="checkbox" ${on ? 'checked' : ''} data-group="${g.key}" data-val="${esc(val)}">
        <span>${esc(label)}</span><span class="cnt">${cnt}</span></label>`;
    }).join('');
    return `<div class="filter-group"><h4>${g.title}</h4>${opts}</div>`;
  }).join('') + `
    <div class="filter-group">
      <h4>更新时间（真实提交）</h4>
      ${FRESH_OPTIONS.map(([v, l]) => `<label class="chk ${state.fresh === v ? 'on' : ''}">
        <input type="radio" name="fresh" value="${v}" ${state.fresh === v ? 'checked' : ''}><span>${l}</span>
        ${v !== 'all' && v !== 'none' ? `<span class="cnt">${DATA.filter(p => p.days != null && (v === 'has' || p.days <= (v === 'd30' ? 30 : v === 'd90' ? 90 : 365))).length}</span>` : ''}
      </label>`).join('')}
    </div>`;

  $$('#filterGroups input[type=checkbox][data-group]').forEach(cb => cb.addEventListener('change', () => {
    const set = state[cb.dataset.group];
    cb.checked ? set.add(cb.dataset.val) : set.delete(cb.dataset.val);
    render();
  }));
  $$('#filterGroups input[name=fresh]').forEach(r => r.addEventListener('change', () => { state.fresh = r.value; render(); }));
}

function renderScenarioOptions() {
  $('#scenario').innerHTML = Object.entries(SCENARIOS).map(([k, v]) =>
    `<option value="${k}" ${state.scenario === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
}

/* ============================================================
 * 8. 渲染：统计卡 / 图表
 * ============================================================ */
function renderStats(list) {
  const n = list.length, pct = x => n ? Math.round(x / n * 100) : 0;
  const commercial = list.filter(p => p.comm === 'yes').length;
  const copyleft = list.filter(p => p.licKind === 'copyleft').length;
  const licUnknown = list.filter(p => p.licKind === 'unknown').length;
  const active = list.filter(p => p.maint === 'active').length;
  const risk = list.filter(p => p.risk !== 'normal').length;
  const api = list.filter(p => p.hasApi).length;
  const avg = n ? Math.round(list.reduce((s, p) => s + scoreOf(p).total, 0) / n) : 0;
  const cards = [
    ['当前结果', n, `全部 ${DATA.length} 个`, ''],
    ['平均选型分', avg, '按当前权重重算', 'p'],
    ['商用友好', commercial, `占 ${pct(commercial)}%`, 'g'],
    ['传染性许可', copyleft, `AGPL/GPL 类 · ${pct(copyleft)}%`, 'w'],
    ['许可未知', licUnknown, '无 License = 默认不可商用', 'r'],
    ['明确活跃', active, `占 ${pct(active)}%`, 'g'],
    ['高风险项目', risk, '营销群发 / 赌博', risk ? 'r' : 'g'],
    ['有真实 API 数据', api, `占 ${pct(api)}%`, ''],
  ];
  $('#stats').innerHTML = cards.map(([k, v, s, cls]) =>
    `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
}

function barChart(el, rows, onClick) {
  const max = Math.max(1, ...rows.map(r => r.value));
  el.innerHTML = rows.map(r => `<div class="bar-row ${r.active ? 'on' : ''}" data-val="${esc(r.key)}">
      <span class="bar-label" title="${esc(r.label)}">${esc(r.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${r.value / max * 100}%;background:${r.color}"></span></span>
      <span class="bar-value">${r.value}</span></div>`).join('');
  el.querySelectorAll('.bar-row').forEach(n => n.addEventListener('click', () => onClick(n.dataset.val)));
}
function donut(el, rows, onClick) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const R = 46, C = 60, SW = 16, CIRC = 2 * Math.PI * R;
  let off = 0;
  const arcs = rows.filter(r => r.value > 0).map(r => {
    const len = r.value / total * CIRC;
    const seg = `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${r.color}"
      stroke-width="${r.active ? SW + 4 : SW}" stroke-dasharray="${Math.max(0.5, len - 2)} ${CIRC - Math.max(0.5, len - 2)}"
      stroke-dashoffset="${-off}" transform="rotate(-90 ${C} ${C})" data-val="${esc(r.key)}"
      style="cursor:pointer;transition:.2s"><title>${esc(r.label)} ${r.value}</title></circle>`;
    off += len; return seg;
  }).join('');
  el.innerHTML = `<div class="donut-wrap">
    <svg viewBox="0 0 120 120" width="128" height="128">${arcs}
      <text x="${C}" y="${C - 2}" text-anchor="middle" class="donut-center">${total}</text>
      <text x="${C}" y="${C + 13}" text-anchor="middle" class="donut-sub">个项目</text></svg>
    <div class="legend">${rows.map(r => `<span data-val="${esc(r.key)}" class="${r.active ? '' : 'off'}">
      <i class="dot" style="background:${r.color}"></i>${esc(r.label)} <b>${r.value}</b></span>`).join('')}</div></div>`;
  el.querySelectorAll('[data-val]').forEach(n => n.addEventListener('click', () => onClick(n.dataset.val)));
}
function toggleSet(key, val) { state[key].has(val) ? state[key].delete(val) : state[key].add(val); }

function renderCharts(list) {
  barChart($('#chartCat'), Object.keys(CATEGORIES).map(k => ({
    key: k, label: CATEGORIES[k].label, color: CATEGORIES[k].color,
    value: list.filter(p => p.cat === k).length, active: state.cats.has(k),
  })), v => { toggleSet('cats', v); render(); });

  const langRows = [...new Set(DATA.map(p => p.lang))].sort().map((k, i) => ({
    key: k, label: k, color: LANG_COLORS[i % LANG_COLORS.length],
    value: list.filter(p => p.lang === k).length, active: state.langs.has(k),
  }));
  donut($('#chartLang'), langRows, v => { toggleSet('langs', v); render(); });

  donut($('#chartLic'), Object.keys(LICKIND_LABEL).map(k => ({
    key: k, label: LICKIND_LABEL[k], color: LICKIND_COLOR[k],
    value: list.filter(p => p.licKind === k).length, active: state.licKinds.has(k),
  })), v => { toggleSet('licKinds', v); render(); });

  barChart($('#chartMaint'), Object.keys(MAINT_LABEL).map(k => ({
    key: k, label: MAINT_LABEL[k],
    color: k === 'active' ? '#22c8a0' : k === 'maintained' ? '#4f8cff' : k === 'stale' ? '#ff5d5d' : '#69768d',
    value: list.filter(p => p.maint === k).length, active: state.maints.has(k),
  })), v => { toggleSet('maints', v); render(); });

  // 更新时间分桶（真实提交）
  const buckets = [
    { key: 'b30', label: '1 个月内', max: 30, color: '#22c8a0' },
    { key: 'b90', label: '1-3 个月', max: 90, color: '#4f8cff' },
    { key: 'b180', label: '3-6 个月', max: 180, color: '#a06bff' },
    { key: 'b365', label: '6-12 个月', max: 365, color: '#f5a524' },
    { key: 'bold', label: '1 年以上', max: Infinity, color: '#ff5d5d' },
    { key: 'none', label: '待核实', max: null, color: '#69768d' },
  ];
  const prev = buckets.map(b => ({ ...b, prev: b.max })).map((b, i) => b);
  const rows = buckets.map((b, i) => {
    const lo = i === 0 ? -Infinity : buckets[i - 1].max;
    const value = b.max === null ? list.filter(p => p.days == null).length
      : list.filter(p => p.days != null && p.days > (i === 0 ? -Infinity : lo) && p.days <= b.max).length;
    return { key: b.key, label: b.label, color: b.color, value, active: false };
  });
  barChart($('#chartPush'), rows, () => toast('该图表仅作分布参考，用左侧「更新时间」筛选更精确'));
}

/* ============================================================
 * 9. 渲染：列表
 * ============================================================ */
function scoreBadge(p) {
  const s = scoreOf(p);
  return `<span class="score ${scoreClass(s.total)}" title="商用 ${s.lic} · 中文 ${s.zh} · 活跃 ${s.act} · 匹配 ${s.rel}">${s.total}<small>分</small></span>`;
}

function renderList(list) {
  const el = $('#list');
  el.className = 'list ' + (state.view === 'card' ? 'card-view' : '');

  if (!list.length) {
    const needMeta = ['d30', 'd90', 'y1'].includes(state.fresh) && !Object.keys(META).length;
    el.innerHTML = `<div class="empty"><div class="big">🔍</div><p>没有符合条件的结果</p>
      ${needMeta ? `<p style="font-size:12.5px">「更新时间」筛选需要 GitHub API 数据，请先运行 <code>node fetch-github-meta.mjs</code></p>` : ''}
      <button class="btn" onclick="resetAll()">清空筛选</button></div>`;
    return;
  }

  /* ---- 收藏夹视图：可写备注 ---- */
  if (state.mode === 'fav') {
    el.innerHTML = `<div class="fav-head">
        <div><b>⭐ 我的收藏夹</b> · ${FAVS.size} 个项目 · 备注实时保存</div>
        <div class="fav-actions">
          <button class="btn tiny" id="btnFavMd">复制为 Markdown</button>
          <button class="btn tiny" id="btnFavCsv">导出 CSV</button>
          <button class="btn tiny ghost" id="btnFavClear">清空收藏</button>
        </div></div>` + list.map(p => `
      <div class="favitem" data-id="${p.id}">
        <div class="favmain">
          <div class="name">${esc(p.name)} <span class="badge b-mute">${esc(CATEGORIES[p.cat].label)}</span>
            ${scoreBadge(p)}</div>
          <p class="desc">${esc(p.desc)}</p>
          <div class="meta">
            <span class="badge ${COMM_CLASS[p.comm]}">${COMM_LABEL[p.comm]}</span>
            <span class="badge ${MAINT_CLASS[p.maint]}">${MAINT_LABEL[p.maint]}</span>
            <span class="badge b-mute">${esc(p.lic || '无协议')}</span>
            <span class="badge b-mute">${p.pushed ? '提交 ' + p.pushed : '提交待核实'}</span>
            ${p.stars != null ? `<span class="badge b-mute">★ ${p.stars}</span>` : ''}
            <a href="${esc(p.url)}" target="_blank" rel="noopener">打开仓库 ↗</a>
          </div>
        </div>
        <textarea class="note" data-note="${p.id}" placeholder="写点调研笔记：能不能用、坑在哪、要不要采用…">${esc(p.note_text)}</textarea>
      </div>`).join('');

    el.querySelectorAll('.favitem').forEach(n => {
      const ta = n.querySelector('.note');
      let t;
      ta.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          NOTES[ta.dataset.note] = ta.value; store.set(K.notes, NOTES);
          const pr = DATA.find(x => x.id === ta.dataset.note);
          if (pr) pr.note_text = ta.value;
        }, 400);
      });
      ta.addEventListener('blur', () => { NOTES[ta.dataset.note] = ta.value; store.set(K.notes, NOTES); });
      n.querySelector('.favmain').addEventListener('click', e => {
        if (e.target.tagName === 'A') return;
        openDrawer(n.dataset.id);
      });
    });
    $('#btnFavMd').onclick = () => copyText(favMarkdown(list), '收藏夹（含笔记）已复制为 Markdown');
    $('#btnFavCsv').onclick = () => exportCSV(list, true);
    $('#btnFavClear').onclick = () => {
      if (!confirm('确定清空所有收藏？笔记会保留。')) return;
      FAVS.clear(); store.set(K.favs, []); DATA.forEach(p => p.isFav = false); render();
    };
    return;
  }

  /* ---- 卡片视图 ---- */
  if (state.view === 'card') {
    el.innerHTML = list.map(p => {
      const up = p.pushed ? `<span class="badge b-conf" title="GitHub 最近提交">提交 ${p.pushed}（${fmtDays(p.days)}）</span>`
        : '<span class="badge b-mute">提交待核实</span>';
      return `<article class="pcard ${state.compare.has(p.id) ? 'selected' : ''}" data-id="${p.id}">
        <span class="fav ${FAVS.has(p.id) ? 'on' : ''}" data-fav="${p.id}" title="收藏">★</span>
        <span class="cmpbox ${state.compare.has(p.id) ? 'on' : ''}" data-cmp="${p.id}" title="加入对比">${state.compare.has(p.id) ? '✓' : '+'}</span>
        ${scoreBadge(p)}
        <div class="row1"><div>
          <div class="name">${esc(p.name)}${p.custom ? ' <span class="badge b-conf">采集</span>' : ''}</div>
          <div class="meta" style="margin-top:4px">
            <span class="dot" style="background:${CATEGORIES[p.cat].color}"></span>${esc(CATEGORIES[p.cat].label)}
            · ${esc(p.lang)}${p.stars != null ? ` · ★ ${p.stars}` : ''}${p.zh === 'yes' ? ' · 🇨🇳' : ''}</div>
        </div></div>
        <p class="desc">${esc(p.desc)}</p>
        <div class="tagline">${p.tags.slice(0, 4).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="meta">
          <span class="badge ${COMM_CLASS[p.comm]}">${COMM_LABEL[p.comm]}</span>
          <span class="badge ${MAINT_CLASS[p.maint]}">${MAINT_LABEL[p.maint]}</span>
          <span class="badge b-mute">${esc(p.lic || 'License 待核实')}</span>
          ${p.risk !== 'normal' ? `<span class="badge b-dang">${RISK_LABEL[p.risk]}</span>` : ''}
          ${up}
          <span class="badge b-mute" title="历史出现次数">热度 ${p.mentions}</span>
          ${p.note_text ? '<span class="badge b-warn">📝 有笔记</span>' : ''}
        </div></article>`;
    }).join('');
  } else {
    /* ---- 表格视图 ---- */
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr>
        <th style="width:34px">对比</th><th data-sort="score">分</th><th data-sort="name">项目</th>
        <th data-sort="cat">分类</th><th>技术栈</th><th>许可证</th><th>商用</th><th>维护</th>
        <th data-sort="pushed">最近提交</th><th data-sort="stars">★</th><th data-sort="mentions">热度</th>
        <th>中文</th><th>风险</th><th>功能</th>
      </tr></thead><tbody>
      ${list.map(p => `<tr data-id="${p.id}" class="${state.compare.has(p.id) ? 'selected' : ''}">
        <td><span class="cmpbox ${state.compare.has(p.id) ? 'on' : ''}" data-cmp="${p.id}">${state.compare.has(p.id) ? '✓' : '+'}</span></td>
        <td><span class="score sm ${scoreClass(scoreOf(p).total)}">${scoreOf(p).total}</span></td>
        <td><b>${esc(p.name)}</b>${p.note_text ? ' 📝' : ''}</td>
        <td><span class="dot" style="background:${CATEGORIES[p.cat].color};display:inline-block;margin-right:5px"></span>${esc(CATEGORIES[p.cat].label)}</td>
        <td>${esc(p.lang)}</td><td>${esc(p.lic || '待核实')}</td>
        <td><span class="badge ${COMM_CLASS[p.comm]}">${COMM_LABEL[p.comm]}</span></td>
        <td><span class="badge ${MAINT_CLASS[p.maint]}">${MAINT_LABEL[p.maint]}</span></td>
        <td>${p.pushed ? `${esc(p.pushed)} <span class="hint">${fmtDays(p.days)}</span>` : '待核实'}</td>
        <td>${p.stars != null ? p.stars : '—'}</td><td>${p.mentions}</td>
        <td>${p.zh === 'yes' ? '🇨🇳' : '—'}</td>
        <td>${p.risk === 'normal' ? '—' : `<span class="badge b-dang">${RISK_LABEL[p.risk]}</span>`}</td>
        <td class="desc">${esc(p.desc)}</td></tr>`).join('')}
      </tbody></table></div>`;
    el.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      state.sort = th.dataset.sort; $('#sort').value = state.sort; render();
    }));
  }

  el.querySelectorAll('[data-fav]').forEach(n => n.addEventListener('click', e => {
    e.stopPropagation();
    const id = n.dataset.fav;
    FAVS.has(id) ? FAVS.delete(id) : FAVS.add(id);
    store.set(K.favs, [...FAVS]);
    DATA.forEach(p => p.isFav = FAVS.has(p.id));
    toast(FAVS.has(id) ? '已加入收藏 ⭐' : '已取消收藏');
    render();
  }));
  el.querySelectorAll('[data-cmp]').forEach(n => n.addEventListener('click', e => {
    e.stopPropagation(); toggleCompare(n.dataset.cmp);
  }));
  el.querySelectorAll('[data-id]').forEach(n => n.addEventListener('click', e => {
    if (e.target.closest('[data-fav],[data-cmp]') || e.target.tagName === 'A') return;
    openDrawer(n.dataset.id);
  }));
}

/* ============================================================
 * 10. 对比
 * ============================================================ */
function toggleCompare(id) {
  if (state.compare.has(id)) state.compare.delete(id);
  else {
    if (state.compare.size >= 4) { toast('最多同时对比 4 个，请先移除一个'); return; }
    state.compare.add(id);
  }
  render();
}
function renderCompareBar() {
  const bar = $('#compareBar');
  const ids = [...state.compare];
  bar.classList.toggle('show', ids.length > 0);
  $('#cmpCount').textContent = ids.length;
  $('#cmpNames').innerHTML = ids.map(id => {
    const p = DATA.find(x => x.id === id);
    return p ? `<span class="cbname">${esc(p.name.split('/').pop())}<i data-rm="${id}">✕</i></span>` : '';
  }).join('');
  bar.querySelectorAll('[data-rm]').forEach(n => n.addEventListener('click', () => toggleCompare(n.dataset.rm)));
  $('#btnCompare').disabled = ids.length < 2;
}

const CMP_ROWS = [
  ['选型评分', p => scoreOf(p).total, (a, b) => b - a, 'score'],
  ['分类', p => CATEGORIES[p.cat].label],
  ['技术栈', p => p.lang],
  ['许可证', p => p.lic || '未标注'],
  ['商用结论', p => COMM_LABEL[p.comm], (a, b) => ({ yes: 4, caution: 3, unknown: 2, no: 1 }[a] || 0) - ({ yes: 4, caution: 3, unknown: 2, no: 1 }[b] || 0)],
  ['维护状态', p => MAINT_LABEL[p.maint], (a, b) => ({ active: 4, maintained: 3, unknown: 2, stale: 1 }[a] || 0) - ({ active: 4, maintained: 3, unknown: 2, stale: 1 }[b] || 0)],
  ['最近提交', p => p.pushed ? `${p.pushed}（${fmtDays(p.days)}）` : '待核实', null, 'date'],
  ['Star', p => p.stars != null ? p.stars : '—', (a, b) => (Number(a) || -1) - (Number(b) || -1), 'num'],
  ['Fork', p => p.forks != null ? p.forks : '—', (a, b) => (Number(a) || -1) - (Number(b) || -1), 'num'],
  ['Open Issues', p => p.openIssues != null ? p.openIssues : '—'],
  ['历史热度', p => p.mentions + ' 次', (a, b) => parseInt(a) - parseInt(b), 'num'],
  ['中文友好', p => p.zh === 'yes' ? '是 🇨🇳' : '否'],
  ['风险等级', p => RISK_LABEL[p.risk]],
  ['数据来源', p => p.hasApi ? (p.baked && !META[p.id] ? 'API 实测（已烘焙进 data.js）' : 'GitHub API 实测') : '推断，待核实'],
  ['评分明细', p => { const s = scoreOf(p); return `商用 ${s.lic} / 中文 ${s.zh} / 活跃 ${s.act} / 匹配 ${s.rel}`; }],
  ['标签', p => p.tags.join('、')],
  ['功能', p => p.desc],
  ['我的备注', p => p.note_text || '—'],
];

function renderCompare() {
  const ids = [...state.compare];
  const list = ids.map(id => DATA.find(p => p.id === id)).filter(Boolean);
  if (list.length < 2) { toast('至少选择 2 个项目'); return; }

  const body = `<table class="cmp-table"><thead><tr><th>参数</th>
    ${list.map(p => `<th><div class="cmpname">${esc(p.name)}</div>
      <div class="cmpmeta">${esc(CATEGORIES[p.cat].label)} · ${esc(p.lang)}</div>
      <a href="${esc(p.url)}" target="_blank" rel="noopener">仓库 ↗</a>
      <button class="btn tiny ghost" data-rm="${p.id}">移除</button></th>`).join('')}</tr></thead>
    <tbody>${CMP_ROWS.map(([label, fn, better, mode]) => {
      const vals = list.map(fn);
      let bestIdx = -1;
      if (better && vals.every(v => v !== '—' && v != null)) {
        let best = vals[0]; bestIdx = 0;
        for (let i = 1; i < vals.length; i++) if (better(vals[i], best) > 0) { best = vals[i]; bestIdx = i; }
      } else if (mode === 'date') {
        bestIdx = vals.indexOf(vals.slice().sort().reverse()[0]);
      } else if (mode === 'num') {
        let bv = -1; vals.forEach((v, i) => { const n = Number(v); if (!isNaN(n) && n > bv) { bv = n; bestIdx = i; } });
      }
      return `<tr><td class="cmp-label">${esc(label)}</td>${vals.map((v, i) =>
        `<td class="${i === bestIdx ? 'best' : ''}">${esc(v)}${i === bestIdx ? ' <span class="bestmark">优</span>' : ''}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table>`;

  $('#cmpBody').innerHTML = body;
  $('#cmpBody').querySelectorAll('[data-rm]').forEach(n => n.addEventListener('click', () => {
    toggleCompare(n.dataset.rm); renderCompare();
  }));
  openModal('cmpMask');
}

function compareMarkdown() {
  const list = [...state.compare].map(id => DATA.find(p => p.id === id)).filter(Boolean);
  const rows = CMP_ROWS.map(([label, fn]) => `| ${label} | ${list.map(p => String(fn(p)).replace(/\|/g, '\\|')).join(' | ')} |`);
  return ['# Telegram 开源项目对比', '',
    `> 生成时间：${new Date().toLocaleString()} · 评分权重：商用 ${state.w.lic} / 中文 ${state.w.zh} / 活跃 ${state.w.act} / 匹配 ${state.w.rel}（场景：${SCENARIOS[state.scenario].label}）`, '',
    `| 参数 | ${list.map(p => p.name).join(' | ')} |`,
    `| --- | ${list.map(() => '---').join(' | ')} |`,
    ...rows, ''].join('\n');
}

/* ============================================================
 * 11. 详情抽屉（含笔记）
 * ============================================================ */
function openDrawer(id) {
  const p = DATA.find(x => x.id === id); if (!p) return;
  const s = scoreOf(p);
  const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  $('#drawer').innerHTML = `
    <button class="close" onclick="closeDrawer()">✕</button>
    <h2>${esc(p.name)}</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px">
      <span class="badge" style="background:${CATEGORIES[p.cat].color}22;color:${CATEGORIES[p.cat].color}">${esc(CATEGORIES[p.cat].label)}</span>
      <span class="badge ${COMM_CLASS[p.comm]}">${COMM_LABEL[p.comm]}</span>
      <span class="badge ${MAINT_CLASS[p.maint]}">${MAINT_LABEL[p.maint]}</span>
      ${p.zh === 'yes' ? '<span class="badge b-ok">中文友好</span>' : ''}
      ${p.risk !== 'normal' ? `<span class="badge b-dang">${RISK_LABEL[p.risk]}</span>` : ''}
      ${p.custom ? '<span class="badge b-conf">采集入库</span>' : ''}
    </div>
    <p class="desc-full">${esc(p.desc)}</p>

    <div class="dsec scorebox">
      <h4>选型评分</h4>
      <div class="scorerow"><b class="score big ${scoreClass(s.total)}">${s.total}</b>
        <div class="scorebars">
          ${[['商用许可', s.lic], ['中文文档', s.zh], ['维护活跃', s.act], ['功能匹配', s.rel]].map(([k, v]) =>
            `<div class="sb"><span>${k}</span><i><b style="width:${v}%;background:${v >= 75 ? '#22c8a0' : v >= 55 ? '#4f8cff' : v >= 40 ? '#f5a524' : '#ff5d5d'}"></b></i><em>${v}</em></div>`).join('')}
        </div></div>
      <div class="hint">权重可在左侧调整；场景：${esc(SCENARIOS[state.scenario].label)}</div>
    </div>

    <div class="dsec"><h4>关键信息</h4><dl class="kv">
      ${row('仓库', `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url.replace(/^https?:\/\/github\.com\//, ''))} ↗</a>`)}
      ${row('技术栈', esc(p.lang))}
      ${row('许可证', p.lic ? `${esc(p.lic)}（${LICKIND_LABEL[p.licKind]}）` : '<span style="color:var(--warn)">未标注 — 无协议默认保留所有权利</span>')}
      ${row('商用结论', COMM_LABEL[p.comm])}
      ${row('维护状态', `${MAINT_LABEL[p.maint]}<span class="hint">${p.hasApi ? '（按真实提交时间判定）' : '（推断）'}</span>`)}
      ${row('最近提交', p.pushed ? `${esc(p.pushed)} · ${fmtDays(p.days)}` : '<span style="color:var(--warn)">待核实</span>')}
      ${row('Star / Fork', p.stars != null ? `★ ${p.stars} / ${p.forks ?? '—'}` : '待核实')}
      ${row('历史热度', p.mentions + ' 次出现 · 最近 ' + esc(p.seen))}
      ${row('数据来源', p.hasApi
        ? '<span class="badge b-ok">GitHub API 实测</span>' + (p.baked && !META[p.id] ? ' <span class="hint">已烘焙进 data.js</span>' : '')
        : '<span class="badge b-warn">推断，未核实</span>')}
      ${row('数据可信度', { high: '高', medium: '中', low: '低' }[p.conf] || '低')}
    </dl></div>

    <div class="dsec"><h4>📝 我的调研笔记</h4>
      <textarea class="note" id="drawerNote" data-note="${p.id}"
        placeholder="能不能用？坑在哪？要不要采用？对比结论…">${esc(p.note_text)}</textarea>
      <div class="hint" id="noteHint">自动保存到本地浏览器</div></div>

    <div class="dsec"><h4>标签</h4><div class="tagline">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
    ${p.note ? `<div class="dsec"><h4>备注</h4><p class="desc-full" style="color:var(--warn)">⚠ ${esc(p.note)}</p></div>` : ''}
    <div class="dsec" style="display:flex;gap:8px;flex-wrap:wrap">
      <a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">打开仓库 ↗</a>
      <button class="btn ghost" onclick="window.__fav('${p.id}')">${FAVS.has(p.id) ? '★ 取消收藏' : '☆ 加入收藏'}</button>
      <button class="btn ghost" onclick="window.__cmp('${p.id}')">${state.compare.has(p.id) ? '移出对比' : '加入对比'}</button>
    </div>`;

  const ta = $('#drawerNote');
  let t;
  const save = () => {
    NOTES[p.id] = ta.value; store.set(K.notes, NOTES); p.note_text = ta.value;
    const h = $('#noteHint'); if (h) h.textContent = '已保存 ✓ ' + new Date().toLocaleTimeString();
  };
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(save, 400); });
  ta.addEventListener('blur', save);

  $('#drawer').classList.add('open'); $('#drawerMask').classList.add('open');
}
function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerMask').classList.remove('open'); }
window.closeDrawer = closeDrawer;
window.__fav = (id) => {
  FAVS.has(id) ? FAVS.delete(id) : FAVS.add(id);
  store.set(K.favs, [...FAVS]); DATA.forEach(p => p.isFav = FAVS.has(p.id));
  render(); openDrawer(id);
};
window.__cmp = (id) => { toggleCompare(id); openDrawer(id); };

/* ============================================================
 * 12. 采集器
 * ============================================================ */
const RESERVED = new Set(['search', 'topics', 'orgs', 'features', 'about', 'pricing', 'marketplace', 'sponsors', 'settings', 'notifications', 'login', 'join', 'blog', 'docs', 'collections', 'trending', 'new', 'apps', 'site', 'readme', 'security', 'enterprise', 'customer-stories', 'solutions', 'resources', 'events', 'open-source', 'stars', 'watching', 'issues', 'pulls']);

function slugOf(url) { return url.replace(/^https?:\/\/github\.com\//i, '').replace(/[#?].*$/, '').replace(/\/$/, ''); }
function idOf(slug) { return slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
function knownIds() { return new Set(DATA.map(p => p.id)); }
function knownSlugs() { return new Set(DATA.map(p => p.url.replace(/^https?:\/\/github\.com\//i, '').toLowerCase())); }

/** 从任意文本里提取 GitHub 仓库链接 */
function extractRepos(text) {
  const re = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g;
  const found = new Map();
  let m;
  while ((m = re.exec(text))) {
    const owner = m[1];
    let repo = m[2];
    if (RESERVED.has(owner.toLowerCase())) continue;
    if (repo.endsWith('.git')) repo = repo.slice(0, -4);
    const slug = `${owner}/${repo}`;
    found.set(slug.toLowerCase(), slug);
  }
  return [...found.values()];
}

/** 把 GitHub API 的 repo 对象转成候选条目 */
function toCandidate(r, manual) {
  manual = manual || {};
  const slug = r.full_name;
  const text = `${slug} ${r.description || ''} ${(r.topics || []).join(' ')}`;
  const spdx = r.license && r.license.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null;
  const licKind = !spdx ? 'unknown' : /^(MIT|Apache|BSD|ISC|Unlicense|0BSD|CC0)/i.test(spdx) ? 'permissive' : /GPL/i.test(spdx) ? 'copyleft' : 'unknown';
  return {
    id: idOf(slug), name: slug, url: `https://github.com/${slug}`,
    lang: r.language || '其他', cat: manual.cat || guessCat(text),
    desc: manual.desc || r.description || '（无描述，建议手动补充）',
    tags: (r.topics || []).slice(0, 6).concat(manual.tags || []),
    lic: spdx, licKind, comm: licKind === 'permissive' ? 'yes' : licKind === 'copyleft' ? 'caution' : 'unknown',
    maint: r.pushed_at ? maintFromDays(daysAgo(r.pushed_at)) : 'unknown',
    seen: new Date().toISOString().slice(0, 10), mentions: 0, risk: 'normal', conf: 'low',
    custom: true,
    _pushed: r.pushed_at ? String(r.pushed_at).slice(0, 10) : null,
    _stars: r.stargazers_count, _forks: r.forks_count, _openIssues: r.open_issues_count,
    _archived: !!r.archived,
  };
}

/** 用 GitHub API 补全单个 slug */
async function enrichCandidate(slug) {
  const res = await fetch(`https://api.github.com/repos/${slug}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 403 || res.status === 429) throw new Error('触发 GitHub 限流，稍后再试或分批补全');
  if (res.status === 404) throw new Error('仓库不存在或已改名');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function addToCand(list) {
  const have = new Set(CANDS.map(c => c.name.toLowerCase()));
  let added = 0;
  list.forEach(c => { if (!have.has(c.name.toLowerCase())) { CANDS.push(c); have.add(c.name.toLowerCase()); added++; } });
  store.set(K.cand, CANDS);
  renderPool(); $('#poolCount').textContent = CANDS.length;
  return added;
}

function renderTextResult(repos) {
  const el = $('#colTextResult');
  if (!repos.length) { el.innerHTML = '<p class="hint" style="margin-top:10px">没提取到新的 GitHub 仓库链接（可能都已存在）。</p>'; return; }
  el.innerHTML = `<div class="colresult"><div class="colrtitle">提取到 ${repos.length} 个新仓库</div>
    <div class="pilllist">${repos.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>
    <button class="btn" id="btnTextAdd">＋ 全部加入候选池${$('#colDeep').checked ? '（并补全数据，需配额）' : ''}</button></div>`;
  $('#btnTextAdd').onclick = async () => {
    const btn = $('#btnTextAdd'); btn.disabled = true;
    const deep = $('#colDeep').checked;
    const out = [];
    for (let i = 0; i < repos.length; i++) {
      btn.textContent = `处理中 ${i + 1}/${repos.length}…`;
      try {
        const r = deep ? await enrichCandidate(repos[i]) : { full_name: repos[i] };
        out.push(toCandidate(r, {}));
      } catch (e) { toast(e.message); break; }
      if (deep) await new Promise(r => setTimeout(r, 300));
    }
    const added = addToCand(out);
    btn.disabled = false;
    toast(`已加入候选池 ${added} 个，切到「③ 候选池」查看`);
    renderTextResult([]);
  };
}

async function runSearch() {
  const q = $('#qAll').value.trim() || 'telegram bot';
  const stars = $('#qStars').value || 50;
  const days = $('#qDays').value || 180;
  const lang = $('#qLang').value;
  const sort = $('#qSort').value;
  const date = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  let query = `${q} stars:>=${stars} pushed:>=${date}`;
  if (lang) query += ` language:${lang}`;

  const el = $('#colApiResult');
  el.innerHTML = '<p class="hint" style="margin-top:10px">搜索中…</p>';
  try {
    const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=30`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (res.status === 403 || res.status === 429) throw new Error('搜索配额已用尽（未认证 10 次/分钟），请等 1 分钟再试');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const known = knownSlugs();
    const candNames = new Set(CANDS.map(c => c.name.toLowerCase()));
    const items = (j.items || []).filter(r => !known.has(r.full_name.toLowerCase()));
    el.innerHTML = `<div class="colresult">
      <div class="colrtitle">共 ${j.total_count} 个结果，本次返回 ${items.length} 个新仓库（已过滤已在面板中的）</div>
      <div class="apiList">${items.map((r, i) => `<label class="apitem">
        <input type="checkbox" data-i="${i}" ${candNames.has(r.full_name.toLowerCase()) ? 'disabled' : 'checked'}>
        <div><div class="apname">${esc(r.full_name)} <span class="hint">★${r.stargazers_count} · ${esc(r.language || '—')} · ${esc((r.pushed_at || '').slice(0, 10))}</span></div>
        <div class="apdesc">${esc((r.description || '').slice(0, 150) || '（无描述）')}</div></div>
        <span class="badge b-mute">${esc(guessCat(`${r.full_name} ${r.description || ''} ${(r.topics || []).join(' ')}`))}</span>
      </label>`).join('')}</div>
      <button class="btn" id="btnApiAdd">＋ 把勾选项加入候选池</button></div>`;
    $('#btnApiAdd').onclick = () => {
      const picked = [...el.querySelectorAll('input[type=checkbox]:checked')].map(c => items[+c.dataset.i]);
      const added = addToCand(picked.map(r => toCandidate(r, {})));
      toast(`已加入候选池 ${added} 个`);
    };
  } catch (e) {
    el.innerHTML = `<p class="hint" style="margin-top:10px;color:var(--danger)">搜索失败：${esc(e.message)}</p>`;
  }
}

function renderPool() {
  const el = $('#poolList'); if (!el) return;
  $('#poolCount').textContent = CANDS.length;
  if (!CANDS.length) { el.innerHTML = '<p class="hint" style="margin-top:12px">候选池是空的，先用「① 文本提取」或「② GitHub 搜索」采集。</p>'; return; }
  el.innerHTML = `<div class="pool">${CANDS.map((c, i) => `<div class="poolitem">
      <div class="poolhead">
        <a href="${esc(c.url)}" target="_blank" rel="noopener"><b>${esc(c.name)}</b></a>
        <span class="hint">★${c._stars ?? '—'} · ${esc(c.lang)} · ${esc(c.lic || '无协议')} · ${esc(c._pushed || '')}</span>
        <button class="btn tiny ghost" data-del="${i}">移除</button>
      </div>
      <div class="pooledit">
        <select data-cat="${i}">${Object.keys(CATEGORIES).map(k =>
          `<option value="${k}" ${k === c.cat ? 'selected' : ''}>${esc(CATEGORIES[k].label)}</option>`).join('')}</select>
        <input data-desc="${i}" value="${esc(c.desc)}" placeholder="功能描述">
      </div></div>`).join('')}</div>`;

  el.querySelectorAll('[data-del]').forEach(n => n.addEventListener('click', () => {
    CANDS.splice(+n.dataset.del, 1); store.set(K.cand, CANDS); renderPool();
  }));
  el.querySelectorAll('[data-cat]').forEach(n => n.addEventListener('change', () => { CANDS[+n.dataset.cat].cat = n.value; store.set(K.cand, CANDS); }));
  el.querySelectorAll('[data-desc]').forEach(n => n.addEventListener('input', () => { CANDS[+n.dataset.desc].desc = n.value; store.set(K.cand, CANDS); }));
}

function poolCode(c) {
  return `  { id:'${c.id}', name:'${c.name}', url:'${c.url}', lang:'${c.lang}', cat:'${c.cat}',
    desc:'${String(c.desc).replace(/'/g, "\\'")}',
    tags:[${(c.tags || []).map(t => `'${t}'`).join(', ')}],
    lic:${c.lic ? `'${c.lic}'` : 'null'}, licKind:'${c.licKind}', comm:'${c.comm}', maint:'${c.maint}',
    seen:'${c.seen}', mentions:${c.mentions}, risk:'normal', conf:'low' },`;
}

function addToPanel(cands) {
  const have = knownIds();
  let added = 0;
  cands.forEach(c => {
    if (have.has(c.id)) return;
    // 把采集时抓到的真实数据写进 META，避免重复请求
    if (c._stars != null || c._pushed) {
      META[c.id] = {
        pushedAt: c._pushed, stars: c._stars, forks: c._forks, openIssues: c._openIssues,
        license: c.lic, licenseKind: c.licKind, archived: !!c._archived,
      };
    }
    const { _pushed, _stars, _forks, _openIssues, _archived, ...clean } = c;
    CUSTOM.push(clean);
    DATA.push(enhance(clean));
    have.add(c.id); added++;
  });
  store.set(K.custom, CUSTOM);
  return added;
}

/* ============================================================
 * 13. 导出
 * ============================================================ */
const CSV_HEAD = ['name', 'url', 'cat', 'lang', 'lic', 'licKind', 'comm', 'maint', 'pushed', 'stars', 'seen', 'mentions', 'risk', 'zh', 'score', 'note_text', 'desc', 'tags'];
function toCSV(list) {
  const lines = [CSV_HEAD.join(',')].concat(list.map(p => CSV_HEAD.map(h => {
    let v = h === 'tags' ? p.tags.join('|') : h === 'score' ? scoreOf(p).total : p[h];
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }).join(',')));
  return '\ufeff' + lines.join('\n');
}
function exportCSV(list, isFav) { download(isFav ? 'telegram-favorites.csv' : 'telegram-projects.csv', toCSV(list), 'text/csv'); }
function favMarkdown(list) {
  return ['# ⭐ Telegram 项目收藏夹', '', `> 导出时间：${new Date().toLocaleString()} · 共 ${list.length} 个项目`, '',
    ...list.map(p => [
      `## ${p.name}${p.isFav ? '' : ''}`,
      `- 仓库：${p.url}`,
      `- 分类：${CATEGORIES[p.cat].label} · 技术栈：${p.lang} · 评分：${scoreOf(p).total}`,
      `- 许可：${p.lic || '未标注'}（${COMM_LABEL[p.comm]}） · 维护：${MAINT_LABEL[p.maint]} · 最近提交：${p.pushed || '待核实'}${p.stars != null ? ' · ★' + p.stars : ''}`,
      `- 功能：${p.desc}`,
      p.note_text ? `- **我的笔记**：${p.note_text.replace(/\n/g, ' ')}` : '- 我的笔记：（空）',
      '']).flat(), ''].join('\n');
}

/* ============================================================
 * 14. 主渲染
 * ============================================================ */
function renderChips() {
  const chips = [];
  if (state.mode === 'fav') chips.push(['模式：收藏夹', () => state.mode = 'all']);
  if (state.q) chips.push([`搜索：${state.q}`, () => { state.q = ''; $('#search').value = ''; }]);
  GROUPS.forEach(g => state[g.key].forEach(v =>
    chips.push([g.source().find(o => String(o[0]) === String(v))?.[1] || v, () => state[g.key].delete(v)])));
  if (state.fresh !== 'all') chips.push(['时间：' + FRESH_OPTIONS.find(o => o[0] === state.fresh)[1], () => state.fresh = 'all']);
  if (state.minMentions > 0) chips.push([`热度 ≥ ${state.minMentions}`, () => state.minMentions = 0]);
  [['excludeRisk', '排除高风险'], ['favOnly', '仅收藏 ⭐'], ['noteOnly', '有备注 📝'], ['verifiedOnly', '仅真实数据 ✓']]
    .forEach(([k, l]) => { if (state[k]) chips.push([l, () => state[k] = false]); });
  if (state.scenario !== 'all') chips.push(['场景：' + SCENARIOS[state.scenario].label, () => { state.scenario = 'all'; $('#scenario').value = 'all'; store.set(K.scen, 'all'); }]);

  $('#activeFilters').innerHTML = chips.map((c, i) => `<span class="chip" data-i="${i}">${esc(c[0])} ✕</span>`).join('');
  $$('#activeFilters .chip').forEach(n => n.addEventListener('click', () => { chips[+n.dataset.i][1](); render(); }));
}

function syncHash() {
  const parts = [];
  if (state.q) parts.push('q=' + encodeURIComponent(state.q));
  GROUPS.forEach(g => { if (state[g.key].size) parts.push(g.key + '=' + [...state[g.key]].join(',')); });
  if (state.fresh !== 'all') parts.push('fresh=' + state.fresh);
  if (state.scenario !== 'all') parts.push('scen=' + state.scenario);
  if (state.mode !== 'all') parts.push('mode=' + state.mode);
  if (state.view !== 'card') parts.push('view=' + state.view);
  if (state.sort !== 'score') parts.push('sort=' + state.sort);
  try { history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname); } catch (e) { /* file:// 下忽略 */ }
}
function loadHash() {
  const h = location.hash.replace(/^#/, ''); if (!h) return;
  h.split('&').forEach(kv => {
    const [k, v] = kv.split('='); if (!v) return;
    if (k === 'q') state.q = decodeURIComponent(v);
    else if (GROUPS.some(g => g.key === k)) state[k] = new Set(v.split(','));
    else if (k === 'fresh') state.fresh = v;
    else if (k === 'scen') state.scenario = v;
    else if (k === 'mode') state.mode = v;
    else if (k === 'view') state.view = v;
    else if (k === 'sort') state.sort = v;
  });
}

function render() {
  const list = currentList();
  renderFilters();
  renderStats(list);
  renderCharts(list);
  renderList(list);
  renderChips();
  renderCompareBar();
  $('#resultCount').textContent = list.length;
  $('#favCount').textContent = FAVS.size;
  $$('#modeToggle .btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  syncHash();
}
window.resetAll = resetAll;

/* ============================================================
 * 15. 初始化
 * ============================================================ */
function init() {
  const apiCount = DATA.filter(p => p.hasApi).length;
  const bakedCount = DATA.filter(p => p.baked).length;
  $('#totalCount').textContent = DATA.length;
  $('#metaCount').textContent = apiCount;
  $('#noticeApi').textContent = `真实提交时间 / Star / License（已核实 ${apiCount} 个，其中 ${bakedCount} 个已烘焙进 data.js）`;
  const missing = DATA.length - apiCount;
  $('#noticeMissing').textContent = missing > 0
    ? `还有 ${missing} 个仓库是推断值，运行 node fetch-github-meta.mjs --missing && node bake-meta.mjs 可补齐。`
    : '全部仓库均已核实 🎉';

  // 主题
  const t = store.get(K.theme, null); if (t) document.documentElement.dataset.theme = t;
  $('#btnTheme').onclick = () => {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = cur; store.set(K.theme, cur);
  };

  renderScenarioOptions();

  // 搜索
  let timer;
  $('#search').addEventListener('input', e => {
    clearTimeout(timer); timer = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 180);
  });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  $$('.viewtoggle .btn[data-view]').forEach(b => b.addEventListener('click', () => {
    $$('.viewtoggle .btn[data-view]').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); state.view = b.dataset.view; render();
  }));
  $$('#modeToggle .btn').forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.mode; render();
  }));
  $('#minMentions').addEventListener('input', e => { state.minMentions = +e.target.value; $('#minMentionsVal').textContent = e.target.value; render(); });
  ['excludeRisk', 'favOnly', 'noteOnly', 'verifiedOnly'].forEach(id =>
    $('#' + id).addEventListener('change', e => { state[id] = e.target.checked; render(); }));

  // 选型评分
  $$('.w').forEach(r => r.addEventListener('input', e => {
    const k = e.target.dataset.w;
    state.w[k] = +e.target.value;
    e.target.nextElementSibling.textContent = e.target.value;
    store.set(K.w, state.w); render();
  }));
  $('#scenario').addEventListener('change', e => {
    state.scenario = e.target.value; store.set(K.scen, state.scenario); render();
  });

  // 预设
  $$('.presets .btn').forEach(b => b.addEventListener('click', () => {
    const pre = PRESETS[b.dataset.preset];
    pre.run();
    $$('.presets .btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    render();
    const n = currentList().length;
    toast(n ? `${pre.label}：命中 ${n} 个项目` : `${pre.label}：暂无命中${pre.desc.includes('近 90 天') ? '（需先补齐 API 数据）' : ''}`);
  }));

  $('#btnReset').onclick = resetAll;
  $('#btnCsv').onclick = () => exportCSV(currentList());
  $('#btnJson').onclick = () => download('telegram-projects.json', JSON.stringify(currentList(), null, 2), 'application/json');

  // 对比
  $('#btnCompare').onclick = renderCompare;
  $('#btnCmpClear').onclick = () => { state.compare.clear(); render(); toast('已清空对比列表'); };
  $('#btnCmpMd').onclick = () => copyText(compareMarkdown(), '对比结果已复制为 Markdown');
  $('#btnCmpCsv').onclick = () => {
    const list = [...state.compare].map(id => DATA.find(p => p.id === id)).filter(Boolean);
    exportCSV(list);
  };

  // 抽屉 / 弹窗关闭
  $('#drawerMask').addEventListener('click', closeDrawer);
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
  $$('.modal-mask').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeDrawer();
    $$('.modal-mask').forEach(m => m.classList.remove('open'));
  });

  // 采集器
  $('#btnCollect').onclick = () => { renderPool(); openModal('colMask'); };
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $$('.tabpane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab.dataset.tab));
  }));
  $('#btnParse').onclick = () => {
    const text = $('#colText').value;
    if (!text.trim()) { toast('先粘贴一些文本'); return; }
    const known = knownSlugs();
    const cands = new Set(CANDS.map(c => c.name.toLowerCase()));
    const repos = extractRepos(text).filter(s => !known.has(s.toLowerCase()) && !cands.has(s.toLowerCase()));
    renderTextResult(repos);
    toast(`提取到 ${repos.length} 个新仓库`);
  };
  $('#btnSearch').onclick = runSearch;
  $('#btnPoolAddAll').onclick = () => {
    if (!CANDS.length) { toast('候选池是空的'); return; }
    const added = addToPanel([...CANDS]);
    CANDS.length = 0; store.set(K.cand, []);
    renderPool(); render();
    toast(`已并入面板 ${added} 个项目`);
  };
  $('#btnPoolExport').onclick = () => download('telegram-candidates.json', JSON.stringify(CANDS, null, 2), 'application/json');
  $('#btnPoolCode').onclick = () => {
    if (!CANDS.length) { toast('候选池是空的'); return; }
    copyText('// 把下面这些条目粘进 data.js 的 PROJECTS 数组即可永久保存\n'
      + CANDS.map(poolCode).join('\n'), 'data.js 代码片段已复制');
  };
  $('#btnPoolClear').onclick = () => {
    if (!CANDS.length || !confirm('清空候选池？')) return;
    CANDS.length = 0; store.set(K.cand, []); renderPool(); toast('候选池已清空');
  };

  // 导入 API 数据
  $('#btnMeta').onclick = () => $('#fileMeta').click();
  $('#fileMeta').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const txt = r.result;
        let obj;
        try { obj = JSON.parse(txt); }
        catch (_) { obj = (new Function(txt + ';return typeof GITHUB_META!=="undefined"?GITHUB_META:null;'))(); }
        if (!obj || typeof obj !== 'object') throw new Error('格式不正确');
        window.GITHUB_META = obj;
        location.reload();
      } catch (err) { alert('导入失败：' + err.message); }
    };
    r.readAsText(f);
  });

  // 回填 UI 状态
  loadHash();
  $('#search').value = state.q;
  $('#sort').value = state.sort;
  $('#minMentions').value = state.minMentions;
  $('#minMentionsVal').textContent = state.minMentions;
  ['excludeRisk', 'favOnly', 'noteOnly', 'verifiedOnly'].forEach(id => $('#' + id).checked = !!state[id]);
  $$('.viewtoggle .btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  $$('.w').forEach(r => { r.value = state.w[r.dataset.w]; r.nextElementSibling.textContent = r.value; });

  render();
}
document.addEventListener('DOMContentLoaded', init);
