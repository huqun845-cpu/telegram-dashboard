# Telegram 开源项目洞察面板

把 420 条搜索记录里清理出的 **89 个开源项目**做成可筛选、可视化、可对比、可评分的网页面板。
**纯静态、零依赖、零构建** —— 双击 `index.html` 就能跑（图表是手写 SVG + CSS，没有 CDN）。

## 快速开始

```bash
open index.html                 # 方式一：直接双击
python3 -m http.server 8080     # 方式二：本地服务，地址栏状态同步更稳
```

## 🌐 发布到外网（永久免费）

零依赖静态站，随便丢哪家托管都能跑。一条命令搞定：

```bash
./deploy.sh gh            # GitHub Pages  → https://<用户名>.github.io/telegram-dashboard/
./deploy.sh cloudflare    # Cloudflare Pages（免费无限流量，全球 CDN）
./deploy.sh netlify       # Netlify
./deploy.sh vercel        # Vercel
./deploy.sh surge         # Surge.sh（纯 CLI 注册，最快）
```

首发会要求登录一次（浏览器点「允许」），**之后永久免登录，再跑就是增量更新**。
脚本会先跑一遍 `test.mjs`，不通过就拒绝发布（想强行发布：`SKIP_TEST=1`）。

| 平台 | 免费额度 | 自定义域名 | 说明 |
|---|---|---|---|
| **Cloudflare Pages** | 无限流量 / 500 次构建月 | ✅ | 推荐，全球 CDN 最快，国内可访问性最好 |
| **GitHub Pages** | 100 GB 流量/月 | ✅ | 仓库公开即可，最省事；国内偶尔不稳 |
| Netlify | 100 GB / 300 构建分钟 | ✅ | 拖拽也能部署 |
| Vercel | 100 GB / 100 次部署月 | ✅ | 速度快 |
| Surge.sh | 无限 | ✅ | **不需要注册账号**（邮箱+密码即建即用），但 CDN 节点少 |

> 数据都在 `data.js` 里，**更新数据后重新跑一次 `./deploy.sh <平台>` 即可**。
> 想要自定义域名：先在平台后台绑定域名，再在 DNS 加一条 CNAME 指过去，HTTPS 证书自动签。

## 文件结构

| 文件 | 作用 |
|---|---|
| `index.html` | 页面骨架 |
| `styles.css` | 主题与样式（深色 / 浅色） |
| `data.js` | **主数据集**：89 个项目的全部字段 |
| `app.js` | 全部交互逻辑（筛选 / 图表 / 对比 / 评分 / 采集） |
| `meta.generated.js` | GitHub API 抓来的真实元数据，**已含 58 个仓库** |
| `meta.json` | 同上，原始 JSON |
| `fetch-github-meta.mjs` | 抓取脚本（增量、按热度优先） |
| `bake-meta.mjs` | **烘焙脚本**：把 API 真值写回 `data.js`，并做往返校验 |
| `test.mjs` | 69 条断言的功能测试（Node + DOM 垫片，不需要浏览器） |
| `deploy.sh` | 一键发布到外网（gh / cloudflare / netlify / vercel / surge） |
| `.nojekyll` | 让 GitHub Pages 跳过 Jekyll 处理 |
| `404.html` | 静态托管的兜底页，自动跳回首页 |

## 功能总览

### 📊 可视化
- **8 张统计卡**：结果数、平均选型分、商用友好、传染性许可、许可未知、明确活跃、高风险、真实数据覆盖率
- **5 个图表**（点击图表即筛选，与列表联动）：
  分类分布 · 技术栈圆环 · 许可/商用圆环 · 维护状态 · **更新时间分布（按真实提交分桶）**
- **详情抽屉**：关键信息 + 评分明细条 + 笔记区 + 一键收藏/加入对比

### 🎯 选型评分（可调权重）
分数 = 加权平均，四个维度权重用滑块实时调整（0~5），默认 商用3 / 中文2 / 活跃3 / 匹配2：

| 维度 | 打分依据 |
|---|---|
| 商用许可 | 可商用 100 / 有条件 60 / 待核实 35 / 不建议 0 |
| 中文文档 | 中文 README 或中文社区 100，否则 15 |
| 维护活跃 | 有真实提交：≤30天=100、≤90天=85、≤180天=70、≤1年=50、更久=15 |
| 功能匹配 | 选定「目标场景」后命中场景 100，否则 15；不限场景时按历史热度 |

- 卡片右上角实时显示分数，可「排序：选型评分」
- 目标场景：Mini App 电商 / 频道运营 / 转发同步 / AI 机器人 / Bot 框架 / 群组管理 / 工具 / 资源导航

### ⚡ 智能预设（7 个，一键套用多条件）
`🚀 生产级首选`（近90天提交 ∧ 宽松许可 ∧ 活跃）、`💼 商用安全`、`✅ 商用且维护中`、
`🛍 Mini App 电商`、`🇨🇳 中文友好`、`🔥 高热度`、`⭐ 有 Star 且活跃`

### 📊 项目并排对比
- 卡片/表格上点 `+` 勾选 **2~4 个**，底部浮出对比条 → 开始对比
- 对比表 18 行参数：评分（含分项）、许可证、商用结论、维护状态、最近提交、Star、Fork、Issues、热度、中文友好、风险、数据来源、标签、功能、**我的备注**
- 每行的「最优值」自动高亮（评分/Star/热度取最大，提交时间取最新）
- 可**复制为 Markdown**、**导出 CSV**，适合直接贴进选型文档

### ⭐ 收藏夹 + 调研笔记
- 卡片左上角 ★ 收藏；工具栏切到「⭐ 收藏夹」进入专用视图
- 每个收藏项目配一个**笔记输入框**，输入即自动保存（localStorage），刷新不丢
- 笔记会参与搜索（搜备注内容也能找到），并有「仅看写过备注」开关
- 「复制为 Markdown」/「导出 CSV」会把**笔记一起导出**

### 📡 采集器（三种取数方式）
| 方式 | 说明 |
|---|---|
| ① 文本提取 | 整段粘贴浏览器历史/网页/聊天记录 → 正则提取 `github.com/owner/repo` → 自动过滤 `search`、`topics` 等保留路径、去掉 `.git` 后缀、剔除已在面板中的项目 → 可勾选「自动补全数据」调 API 补 Star/License/更新时间 |
| ② GitHub 搜索 | 关键词 + 最低 Star + 近 N 天有更新 + 语言 + 排序 → 直连 GitHub Search API → 结果自动猜分类 → 勾选入池 |
| ③ 候选池 | 可改分类、改功能描述 → 「全部并入面板」立刻参与筛选评分（真实数据一并带过去）→ 还能「复制 data.js 代码片段」永久写回源码 |

### 🔎 筛选能力（11 个维度 + 组合）
全文搜索（含笔记）· 分类 · 技术栈 · 商用友好度 · 许可证类型 · 维护状态 · **更新时间（真实提交）** ·
**中文友好** · 风险等级 · 热度阈值 · 快捷开关（排除营销赌博 / 仅收藏 / 有备注 / 仅真实数据）

外加：排序 7 种、卡片⇄表格双视图、表头点击排序、已选条件 chips 一键取消、**筛选状态同步到 URL 可分享**、CSV/JSON 导出。

## 关于数据可信度（重要）

| 级别 | 字段 | 来源 |
|---|---|---|
| ✅ **真实** | 出现次数、最近活跃日期 | 你的 420 条搜索记录，直接统计 |
| ✅ **真实（API）** | 最近提交、Star、Fork、Issues、License、是否归档 | GitHub API 实抓，**已覆盖 58/89 个仓库** |
| ✅ **已烘焙** | 上面前 6 项的**最终值已写进 `data.js`**（`src:'api'`） | 由 `bake-meta.mjs` 写入，不依赖运行时外挂文件 |
| ⚠️ 推断 | 未被 API 覆盖的 License / 维护状态 / 商用结论 | 从搜索摘要推断，界面标「待核实」 |

> 真实数据一到位就会**覆盖**推断值：维护状态不再靠猜，而是按最近提交时间自动判定
> （≤90天=活跃 / ≤365天=维护中 / 更久=停更），仓库若已归档会直接标「停更」并写进备注。
> 实测几个和推断不一致的例子：`tgforwarder` 其实是 GPL-3.0、`modzero` 停在 2024 年、`WilliamButcherBot` 是 MIT。

### 🍞 烘焙：让真值不依赖 `meta.generated.js`

页面读取顺序是 `data.js` → `meta.generated.js` → `app.js`，`app.js` 里 `enhance()` **优先用 API 数据**。
但外挂文件一旦丢失/没加载，字段就会退回推断值 —— 所以真实值会被**烘焙**进 `data.js` 本体：

```bash
node bake-meta.mjs --check   # 只报告差异，不改文件（先看会动什么）
node bake-meta.mjs           # 真正写回，自动备份 data.js.bak
```

- 写回字段：`lic` / `licKind` / `comm` / `maint` / `pushedAt` / `stars` / `forks`，并打上 `src:'api'`
- 写入前先备份 `data.js.bak`，写完后**重新 require 做往返校验**，逐字段比对
  （区分「新增字段」和「有意变更」，任何非预期丢失都会报错）
- 实测烘焙结果：**37 个许可证修正、39 个维护状态修正、34 个商用结论修正**
- 顺便自动补备注：**15 个无 LICENSE** 的仓库会被写上「法律上默认保留所有权利」，已归档的会写「作者已停止维护」
- 已加回归测试：把 `meta.generated.js` 换成空对象启动，真值必须仍在（测试第 9 节）

### 补齐剩余 31 个仓库

```bash
cd ~/Documents/telegram-dashboard

# 自动跳过已抓到的，只补缺的（配额 14:55 重置，未认证 60 次/小时）
node fetch-github-meta.mjs --missing

# 推荐：带 token 一次跑完（5000 次/小时）
GITHUB_TOKEN=ghp_xxxx node fetch-github-meta.mjs

# 其他参数
node fetch-github-meta.mjs --limit=20          # 只抓 20 个
node fetch-github-meta.mjs --only=aiogram,ptb  # 只抓指定的
node fetch-github-meta.mjs --no-priority       # 按 data.js 顺序抓，不按热度
```

跑完刷新页面即可；也可以导出 JSON 后用右上角「导入数据」加载。

**抓完记得烘焙一次**，否则真值只活在 `meta.generated.js` 里：`node bake-meta.mjs`

### ⚖️ 选型提醒：没写 LICENSE ≠ 能商用

API 实测发现 15 个仓库**根本没有 LICENSE 文件**，法律上默认「保留所有权利」。电商类里尤其要注意：

| 项目 | 真实许可证 | 能否商用 |
|---|---|---|
| `ilyarolf/AiogramShopBot` | MIT | ✅ |
| `interlumpen/Telegram-shop` | MIT | ✅ |
| `DaniilDonskoy/Shop-bot` | MIT | ✅ |
| `mini-woo/mini-woo` | MIT | ✅ |
| **`unusdon/nova-store-telegram-mini-app`** | **无 LICENSE** | ⚠️ 默认保留所有权利 |
| `unusdon/nova-store-telegram-mini-app-nextjs` | 无 LICENSE | ⚠️ 默认保留所有权利 |
| `JumpCodeFrog/telegram-shop-bot` | 无 LICENSE | ⚠️ 默认保留所有权利 |
| `itzddos/ecommerce-telegram-bot` | 无 LICENSE | ⚠️ 默认保留所有权利 |

合计 **15 个仓库**（含 `mxvsh/modzero`、`leam-tech/frappe_telegram` 等）属于此类，面板里商用列显示「待核实」。

另外 `python-telegram-bot` 常被误以为是 LGPL —— 实际是 **GPL-3.0**；`LangBot` 则是 **Apache-2.0**（可自由商用）。
面板里所有「备注中提到的许可证」都会跟实际许可证做一致性校验（测试第 10 节），防止再出现这种口口相传的错误。

## 二次开发

- **加项目**：`data.js` 的 `PROJECTS` 数组加一条对象（字段照抄），或直接用采集器入库
- **加筛选维度**：`data.js` 加字段 → `app.js` 的 `GROUPS` 加一项
- **改评分逻辑**：`app.js` 的 `scoreOf()` / `activityScore()`
- **改采集分类规则**：`app.js` 的 `CAT_HINTS`（**顺序即优先级**，越专属的越靠前）
- **`src:'api'` 的含义**：这一条的许可证/维护状态/Star 等来自 GitHub 实抓并被烘焙过；没有该标记 = 推断值

## 测试

```bash
node test.mjs
```

覆盖 69 条断言，分 10 节：
1. 数据集完整性（89 个项目、去重、字段齐全）
2. 分类与语言统计
3. 评分四维与权重敏感性
4. 筛选与 7 个智能预设
5. 对比流程（勾选上限 / 表格生成 / 最优值高亮 / Markdown / CSV）
6. 收藏夹与笔记（自动保存 / 参与搜索 / 带笔记导出）
7. 采集器（真实历史片段测提取与去重、分类猜测、候选池去重入库、data.js 片段生成）
8. 导出格式（CSV 列数、JSON 往返）
9. **退化测试**：把 `meta.generated.js` 换成空对象，烘焙的真值必须仍在
10. **文案一致性**：备注里提到的许可证必须等于实际许可证
