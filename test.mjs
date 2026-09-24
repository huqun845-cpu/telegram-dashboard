/* 功能测试：选型评分 / 对比 / 收藏夹+备注 / 采集器 / 预设 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 默认就测「本文件所在目录」——写死某台机器的绝对路径会导致
// 在别处跑时静默加载另一份陈旧副本，测试全绿但测的是旧代码。
const DIR = process.env.TG_DIR || path.dirname(fileURLToPath(import.meta.url));

const mkEl = () => ({
  innerHTML: '', textContent: '', value: '', checked: false, disabled: false, title: '', dataset: {}, style: {},
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false } },
  addEventListener(){}, setAttribute(){}, removeAttribute(){}, appendChild(){}, remove(){}, click(){}, select(){},
  querySelector(){ return mkEl() }, querySelectorAll(){ return [] },
});
const els = {};
const mem = {};
globalThis.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
};
globalThis.document = {
  documentElement: { dataset: {} },
  querySelector: s => (els[s] || (els[s] = mkEl())),
  querySelectorAll: () => [],
  addEventListener(){}, createElement: () => mkEl(), body: mkEl(),
};
globalThis.window = globalThis;
globalThis.history = { replaceState(){} };
globalThis.location = { hash: '', pathname: '/index.html' };
globalThis.confirm = () => true;
globalThis.alert = () => {};

const DATA_SRC = fs.readFileSync(`${DIR}/data.js`, 'utf8');
const APP_SRC = fs.readFileSync(`${DIR}/app.js`, 'utf8');
const META_SRC = fs.readFileSync(`${DIR}/meta.generated.js`, 'utf8');
const EXPOSE = `globalThis.__t = { state, render, DATA, currentList, scoreOf, activityScore, pass, sorted,
      extractRepos, guessCat, toCandidate, addToCand, addToPanel, poolCode, toCSV, favMarkdown,
      compareMarkdown, toggleCompare, renderCompare, renderCompareBar, renderList, openDrawer,
      renderPool, FAVS, NOTES, CAND: CANDS, CUSTOM, META, SCENARIOS, PRESETS, resetFilters,
      DAYS: daysAgo, MAINT: maintFromDays, enhance, store, K, init };`;

/** 用指定的 meta 源码启动一份全新的应用实例 */
function boot(metaSrc, callInit = false) {
  new Function(metaSrc + '\n' + DATA_SRC + '\n' + APP_SRC + '\n' + EXPOSE + '\n' + (callInit ? 'init();' : ''))();
  return globalThis.__t;
}
const T = boot(META_SRC, true);

let pass_ = 0, fail_ = 0;
const check = (name, cond, extra = '') => {
  cond ? pass_++ : fail_++;
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' → ' + extra : ''}`);
};
const n = (s, re) => (s.match(re) || []).length;
const listHTML = () => els['#list'].innerHTML;
const nCards = () => n(listHTML(), /class="pcard[ "]/g);   // 注意卡片 class 后面可能有动态后缀

console.log('\n===== 1. 真实 API 数据生效 =====');
const withApi = T.DATA.filter(p => p.hasApi);
check('API 数据已合并', withApi.length >= 50, withApi.length + ' / ' + T.DATA.length);
const tgfw = T.DATA.find(p => p.id === 'tgforwarder');
check('tgforwarder 用真实 License 覆盖推断', tgfw.lic === 'GPL-3.0' && tgfw.comm === 'caution', `${tgfw.lic} / ${tgfw.comm}`);
const modzero = T.DATA.find(p => p.id === 'modzero');
check('modzero 因久未提交被判为停更', modzero.maint === 'stale' && modzero.days > 365,
  `最近提交 ${modzero.pushed} → ${T.MAINT(modzero.days)}（${modzero.days} 天前）`);
const wbb = T.DATA.find(p => p.id === 'wbb');
// 断言「推导规则」而不是「此刻的结论」——否则测试会随机器时钟一天天烂掉
check('维护状态由真实提交时间推导（≤90活跃 / ≤365维护中 / 更久停更）',
  wbb.maint === T.MAINT(wbb.days) && wbb.days === T.DAYS(wbb.pushed) && wbb.pushed === wbb.pushedAt,
  `${wbb.pushed} → ${wbb.days} 天 → ${wbb.maint}`);
check('daysAgo 与系统时钟一致（不写死天数）', (() => {
  const d = T.DAYS('2026-09-10');
  const expect = Math.round((Date.now() - new Date('2026-09-10T00:00:00').getTime()) / 86400000);
  return Math.abs(d - expect) <= 1;
})(), '2026-09-10 距今 ' + T.DAYS('2026-09-10') + ' 天（机器时钟）');
check('maintFromDays 三档分界正确',
  T.MAINT(0) === 'active' && T.MAINT(90) === 'active' && T.MAINT(91) === 'maintained'
  && T.MAINT(365) === 'maintained' && T.MAINT(366) === 'stale',
  `0→${T.MAINT(0)} 90→${T.MAINT(90)} 91→${T.MAINT(91)} 365→${T.MAINT(365)} 366→${T.MAINT(366)}`);

console.log('\n===== 2. 选型评分 =====');
const sc = T.scoreOf(wbb);
check('评分含 4 个分项', ['total','lic','zh','act','rel'].every(k => typeof sc[k] === 'number'), JSON.stringify(sc));
const before = T.scoreOf(tgfw).total;
T.state.w.lic = 5; T.state.w.act = 0; T.state.w.zh = 0; T.state.w.rel = 0;
const after = T.scoreOf(tgfw).total;
check('调高「商用许可」权重后 GPL 项目分数下降', after !== before, `${before} → ${after}`);
T.state.w.lic = 3; T.state.w.zh = 2; T.state.w.act = 3; T.state.w.rel = 2;
T.state.scenario = 'shop';
const shopScore = T.scoreOf(T.DATA.find(p => p.cat === 'shop' && p.zh === 'yes') || T.DATA.find(p => p.cat === 'shop')).rel;
T.state.scenario = 'all';
check('切换场景会改变「功能匹配」分项', shopScore === 100, 'shop 场景下商城项目 rel=100');
check('活跃项目分数高于停更项目', T.scoreOf(wbb).total > T.scoreOf(modzero).total, `${T.scoreOf(wbb).total} vs ${T.scoreOf(modzero).total}`);

console.log('\n===== 3. 智能预设 =====');
T.PRESETS.prod.run(); T.render();
const prodN = T.currentList().length;
check('🚀 生产级首选 有命中', prodN > 0, prodN + ' 个');
check('  结果全部为宽松许可', T.currentList().every(p => p.licKind === 'permissive'));
check('  结果全部在 90 天内有提交', T.currentList().every(p => p.days != null && p.days <= 90));
T.PRESETS.commercial.run(); T.render();
check('💼 商用安全 全部可商用且无风险', T.currentList().every(p => p.comm === 'yes' && p.risk === 'normal'), T.currentList().length + ' 个');
T.PRESETS.miniapp.run(); T.render();
check('🛍 Mini App 电商 命中商城类', nCards() === 14, nCards() + ' 个');
T.PRESETS.chinese.run(); T.render();
check('🇨🇳 中文友好 全部有中文', T.currentList().length > 5 && T.currentList().every(p => p.zh === 'yes'),
  T.currentList().length + ' 个：' + T.currentList().slice(0, 5).map(p => p.name.split('/').pop()).join(', '));
check('  非中文项目未被误判', T.DATA.filter(p => p.zh === 'yes').length < T.DATA.length * 0.3,
  T.DATA.filter(p => p.zh === 'yes').length + ' / ' + T.DATA.length);
T.resetFilters(); T.render();

console.log('\n===== 4. 对比功能 =====');
T.state.compare.clear();
['novastore', 'shopbot', 'goshop'].forEach(id => T.toggleCompare(id));
check('可勾选 3 个项目', T.state.compare.size === 3);
T.toggleCompare('tgstate'); T.toggleCompare('aiogram');
check('超过 4 个时被拦截', T.state.compare.size === 4, '上限 4 生效');
T.renderCompareBar();
check('浮动条已显示', els['#cmpNames'].innerHTML.includes('nova-store'));
check('对比按钮启用（≥2 个）', els['#btnCompare'].disabled === false);
T.renderCompare();
const cmp = els['#cmpBody'].innerHTML;
check('对比表已生成', cmp.includes('cmp-table') && cmp.includes('nova-store'));
check('对比表含全部参数行', ['选型评分','许可','商用结论','最近提交','Star','中文友好','我的备注'].every(k => cmp.includes(k)));
check('较优值被高亮', cmp.includes('bestmark'));
check('对比表列数 = 4', n(cmp, /class="cmpname"/g) === 4);
const md = T.compareMarkdown();
const mdHead = md.split('\n').find(l => l.startsWith('| 参数 |'));
check('Markdown 导出含 4 列', mdHead.split('|').length - 2 === 5, '表头列数 ' + (mdHead.split('|').length - 2) + '（含名称行共 5 列）');
const csv = T.toCSV([...T.state.compare].map(id => T.DATA.find(p => p.id === id)));
check('对比 CSV 含表头与 4 行', csv.split('\n').length === 5, csv.split('\n')[0].slice(1, 40) + '…');

console.log('\n===== 5. 收藏夹 + 备注 =====');
T.state.compare.clear(); T.state.mode = 'fav';
['novastore', 'chanadmin', 'tgforwarder'].forEach(id => { T.FAVS.add(id); T.store.set(T.K.favs, [...T.FAVS]); });
T.render();
check('收藏夹视图渲染', listHTML().includes('favitem') && listHTML().includes('我的收藏夹'), n(listHTML(), /class="favitem"/g) + ' 个收藏');
check('收藏夹带备注输入框', n(listHTML(), /data-note=/g) === 3);
T.NOTES['novastore'] = '中文界面 + 多语言，无构建步骤，适合免费托管';
T.store.set(T.K.notes, T.NOTES);
T.DATA.forEach(p => p.note_text = T.NOTES[p.id] || '');
T.state.mode = 'all'; T.state.noteOnly = true; T.render();
check('「仅有备注」筛选生效', T.currentList().length === 1, T.currentList()[0].name);
T.state.noteOnly = false;
T.state.mode = 'fav'; T.render();
const favMd = T.favMarkdown(T.currentList());
check('收藏夹导出 Markdown 含笔记', favMd.includes('我的笔记') && favMd.includes('无构建步骤'));
const favCsv = T.toCSV(T.currentList());
check('收藏夹 CSV 含 note_text 列', favCsv.split('\n')[0].includes('note_text') && favCsv.includes('无构建步骤'));
T.state.mode = 'all'; T.render();

console.log('\n===== 6. 采集器：文本提取（真实历史片段）=====');
const historyText = `
2026年9月20日 leduchuong48-byte/telegram_chanel_manager_bot: 面向 Telegram 群组/频道运营 github.com
https://github.com/leduchuong48-byte/telegram_autotgtoward
2026年9月18日 unusdon/nova-store-telegram-mini-app-nextjs: Complete Telegram Mini App eCommerce
github.com/ZeroCool/awesome-new-tg-thing  <-- 新项目，历史里没见过
https://github.com/search?q=telegram   <-- 应被过滤
https://github.com/topics/telegram-bot <-- 应被过滤
https://github.com/new-owner/cool-bot/blob/main/README.md
https://github.com/another/repo.git
`;
const repos = T.extractRepos(historyText);
check('提取到仓库链接', repos.length >= 4, repos.join(', '));
check('过滤掉 search/topics 等保留路径', !repos.some(r => /^(search|topics)\//i.test(r)));
check('去掉 .git 后缀', repos.includes('another/repo'));
check('路径后缀被清理', repos.includes('new-owner/cool-bot'));
const newRepos = (() => {
  const known = new Set(T.DATA.map(p => p.url.replace('https://github.com/', '').toLowerCase()));
  return repos.filter(s => !known.has(s.toLowerCase()));
})();
check('已存在的项目能识别为重复', newRepos.length === 3, `${repos.length} 个链接中 ${newRepos.length} 个是新的：${newRepos.join(', ')}`);
check('  历史里已有过的项目被过滤', !newRepos.includes('leduchuong48-byte/telegram_autotgtoward'));

console.log('\n===== 7. 采集器：候选池 =====');
check('分类猜测：mini app → shop', T.guessCat('nova store telegram mini app ecommerce') === 'shop');
check('分类猜测：bulk sender → growth', T.guessCat('bulk message sender marketing tool') === 'growth');
check('分类猜测：awesome list → awesome', T.guessCat('awesome telegram bots curated list') === 'awesome');
check('分类猜测：转发 → forward', T.guessCat('forward rss sync bot') === 'forward');
const cand = T.toCandidate({
  full_name: 'ZeroCool/cool-tg-bot', description: 'A telegram bot framework with mini app support',
  language: 'Go', stargazers_count: 123, forks_count: 4, open_issues_count: 1,
  pushed_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  license: { spdx_id: 'MIT' }, topics: ['telegram', 'bot'], archived: false,
});
check('候选条目字段完整', ['id','name','url','cat','desc','lic','comm','maint'].every(k => cand[k] != null));
check('候选条目保留真实数据', cand._stars === 123 && cand.lic === 'MIT' && cand.maint === 'active');
check('候选条目自动判为可商用', cand.comm === 'yes');
const added = T.addToCand([cand, cand, { ...cand, id: 'zerocool-another', name: 'ZeroCool/another' }]);
check('候选池去重后入库', added === 2 && T.CAND.length === 2, `候选池 ${T.CAND.length} 个`);
check('生成的 data.js 片段合法', T.poolCode(cand).includes("id:'zerocool-cool-tg-bot'") && T.poolCode(cand).includes("cat:'framework'"), T.poolCode(cand).split('\n')[0].trim());
const beforeLen = T.DATA.length;
const panelAdded = T.addToPanel([...T.CAND]);
check('候选池可并入面板', panelAdded === 2 && T.DATA.length === beforeLen + 2, `面板 ${beforeLen} → ${T.DATA.length}`);
check('并入后真实数据挂进了 META', !!T.META['zerocool-cool-tg-bot'] && T.META['zerocool-cool-tg-bot'].stars === 123);
const newProj = T.DATA.find(p => p.id === 'zerocool-cool-tg-bot');
check('并入的项目可直接参与筛选/评分', T.scoreOf(newProj).total > 0 && newProj.hasApi, '评分 ' + T.scoreOf(newProj).total);
T.CAND.length = 0;
T.render();
check('并入后页面仍正常渲染', nCards() === T.currentList().length, nCards() + ' 卡片 / ' + T.currentList().length + ' 结果');
check('采集项目带「采集」标记', listHTML().includes('b-conf">采集'));

console.log('\n===== 8. 回归：原功能未坏 =====');
T.state.view = 'table'; T.render();
check('表格视图正常', listHTML().includes('<table>') && n(listHTML(), /<tr data-id=/g) === T.DATA.length);
check('表格含评分列', listHTML().includes('data-sort="score"'));
T.state.view = 'card'; T.render();
T.openDrawer('langbot');
check('抽屉含评分明细面板', els['#drawer'].innerHTML.includes('scorebars') && els['#drawer'].innerHTML.includes('选型评分'));
check('抽屉含笔记输入框', els['#drawer'].innerHTML.includes('id="drawerNote"'));
T.state.q = 'Mini App'; T.render();
check('搜索仍可用', T.currentList().length > 0, T.currentList().length + ' 个结果');
T.state.q = ''; T.state.cats = new Set(['ai']); T.render();
check('分类筛选仍可用', T.currentList().length === 13, T.currentList().length + ' 个');
T.resetFilters(); T.render();
check('重置后回到全量', T.currentList().length === T.DATA.length, T.currentList().length + ' 个');

console.log('\n===== 9. 退化测试：meta.generated.js 丢失时仍用烘焙真值 =====');
const T2 = boot('window.GITHUB_META = {};', true);
const bakedN = T2.DATA.filter(p => p.baked).length;
const apiN = T2.DATA.filter(p => p.hasApi).length;
check('meta 为空但烘焙数据仍在', Object.keys(T2.META).length === 0 && bakedN >= 85, `烘焙 ${bakedN} 条，hasApi ${apiN} 条`);
check('许可证不退回「未知」', T2.DATA.filter(p => p.baked && p.licKind === 'unknown' && p.lic).length === 0);
const wbb2 = T2.DATA.find(p => p.id === 'wbb');
check('维护状态仍由烘焙的提交时间推导', wbb2.maint === T2.MAINT(wbb2.days) && wbb2.pushed != null,
  `${wbb2.name} ${wbb2.pushed} → ${wbb2.days} 天 → ${wbb2.maint}`);
check('Star 数仍在', typeof wbb2.stars === 'number' && wbb2.stars > 0, '★' + wbb2.stars);
const ptb2 = T2.DATA.find(p => p.id === 'ptb');
check('GPL 项目仍被判为有条件商用', ptb2.lic === 'GPL-3.0' && ptb2.comm === 'caution', `${ptb2.lic} → ${ptb2.comm}`);
const tele2 = T2.DATA.find(p => p.id === 'telegraf');
check('停更项目仍未被打回活跃', tele2.maint === 'stale' && tele2.days > 365, `${tele2.name} ${tele2.pushed} → ${tele2.days} 天`);
check('统计卡显示核实覆盖率', els['#noticeApi'].textContent.includes('已核实'), els['#noticeApi'].textContent.slice(0, 46) + '…');
T2.PRESETS.prod.run(); T2.render();
check('预设「生产级首选」无 meta 也能筛', T2.currentList().length > 0 && T2.currentList().every(p => p.licKind === 'permissive' && p.days <= 90),
  T2.currentList().length + ' 个');

console.log('\n===== 10. 文案一致性：备注里提到的许可证必须与实际许可证一致 =====');
const LIC_TOKEN = /(AGPL-3\.0|LGPL-3\.0|GPL-3\.0|Apache-2\.0|MPL-2\.0|BSD-3-Clause|BSD-2-Clause|Unlicense|MIT)\b/;
const licConflicts = T.DATA
  .filter(p => p.note && p.lic)
  .map(p => {
    const m = String(p.note).match(LIC_TOKEN);
    return m && m[1].toLowerCase() !== String(p.lic).toLowerCase() ? { p, said: m[1] } : null;
  })
  .filter(Boolean);
check('没有「备注说的许可证 ≠ 实际许可证」的条目', licConflicts.length === 0,
  licConflicts.map(c => `${c.p.id} 备注称 ${c.said} / 实际 ${c.p.lic}`).join('; ') || '全部一致');
const ptbNote = T.DATA.find(p => p.id === 'ptb').note;
check('ptb 备注不再自称 LGPL', !/LGPL/.test(ptbNote), ptbNote);
const lbNote = T.DATA.find(p => p.id === 'langbot').note;
check('langbot 备注已改为 Apache-2.0', /Apache-2\.0/.test(lbNote) && !/AGPL/.test(lbNote), lbNote);

console.log(`\n${'='.repeat(46)}\n结果：${pass_} 通过 / ${fail_} 失败\n${'='.repeat(46)}`);
process.exit(fail_ ? 1 : 0);
