# Telegram 开源项目清单（去重整理）

来源：浏览器历史中 420 条 "telegram" 相关搜索结果（2026-09-05 ~ 2026-09-20）
整理方式：只保留可识别的开源仓库/开源项目，剔除重复条目、官方文档、商业 SaaS、Demo 站点
结果：**约 89 个唯一项目**（原始历史中 GitHub 链接 ~200+ 次，去重率约 60%）

---

## A. 框架 / SDK / 库（12）

1. **aiogram/aiogram**（Python）— 现代化、完全异步的 Telegram Bot API 框架，基于 asyncio。生态里目前性能与易用性最平衡的 Python 框架，v3 支持中间件、FSM、Router。
2. **python-telegram-bot/python-telegram-bot**（Python）— 老牌封装库（"a wrapper you can't refuse"），v20+ 全面 async，文档/examples 极全，社区最大。
3. **telegraf/telegraf**（Node.js）— Node 生态最主流的 Bot 框架，中间件式设计，插件丰富。
4. **PaulSonOfLars/gotgbot**（Go）— 自动生成的 Telegram API Go 封装，API 设计刻意对齐 python-telegram-bot。
5. **go-telegram/bot**（Go）— 更轻量的 Go Bot API 框架，无第三方生成代码依赖。
6. **irazasyed/telegram-bot-sdk**（PHP）— PHP SDK，开箱支持 Laravel（ServiceProvider / Facade）。
7. **leam-tech/frappe_telegram**（Python）— 为 Frappe / ERPNext 提供 Telegram Bot 集成，适合把 ERP 通知与操作搬到 Telegram。
8. **telegraf/template-bot**（Node.js）— Telegraf 官方脚手架模板，快速起一个 bot 项目。
9. **vlymar1/aiogram-bot-template**（Python）— 模块化 aiogram 模板：PostgreSQL + Redis + Docker Compose + Ruff + 内置用户指标管理面板。
10. **UznetDev/Aiogram-Bot-Template**（Python）— aiogram 模板，自带管理面板：管理用户、发广告推送、增删管理员。
11. **Hamed-Gharghi/Cloudflare-Telegram-bot-builder**（JS）— 无代码搭建 Bot：零配置自举的 Cloudflare Workers，带 D1/KV 和可视化规则编辑器，60 秒部署。
12. **developerAmira/telegram-bot**（TS）— 波斯语/英语双语 Bot 管理面板，技术栈 Cloudflare Workers + KV + Hono + Tailwind。

## B. AI / LLM 机器人（13）

13. **yincongcyincong/telegram-deepseek-bot**（Go）— 对接 DeepSeek 等 LLM 的 Telegram 机器人，支持工具调用（function calling），可让 Telegram 里直接调用各种工具，部署简单。
14. **yincongcyincong/MuseBot**（Go）— 多平台 AI Bot：Telegram / Discord / Slack / 飞书 / 钉钉 / 企业微信 / QQ / 微信，兼容 OpenAI、Gemini、DeepSeek、豆包、OpenRouter；支持智能对话、生图、生视频，私聊群聊通用。
15. **langbot-app/LangBot**（Python/TS）— 生产级多平台智能机器人开发平台：Agent、知识库编排、插件系统；覆盖 Discord / Slack / LINE / Telegram / 企业微信 / 公众号 / 飞书 / 钉钉 / QQ / Matrix，可接 ChatGPT、DeepSeek、Dify、n8n、Langflow、Coze、Claude、Gemini、GLM、Ollama、SiliconFlow、Moonshot。**kjsssjj/LangBot 是同一项目的镜像/分叉，不重复计数。**
16. **abirxdhack/DeepSeekBot**（Python）— 基于 Pyrogram + OpenRouter 的 DeepSeek R1 Bot，主打高并发多用户同时响应。
17. **genn-z-cyrax/cyrax_AI_oss**（Python）— AI 多代理系统，把 Telegram 变成自动化中台：动态模型编排，把用户意图路由到视觉 / 浏览器 / 桌面 / 代码 等不同 agent。
18. **Hsoofi82/NovaAgent**（Python, AGPL-3.0）— 免费开源 Telegram AI Agent：能生成并托管 Web App、生成游戏/图片/PDF/语音，号称 10 分钟自托管，全免费额度。
19. **wangrongding/wechat-bot**（Node.js）— 多平台 IM AI 代理（Telegram / WhatsApp / Lark / 微信），可接 ChatGPT / Claude / Kimi / DeepSeek / Ollama，做自动回复、社区分析、联系人管理、不活跃好友检测。
20. **unusdon/ai-chatbot-saas**（Next.js, MIT）— 多租户 RAG 聊天机器人 SaaS：PDF/DOCX/URL 训练，一次部署同时输出 Web 挂件 + Telegram + WhatsApp，支持 5 家 LLM（OpenAI / Claude / Gemini / DeepSeek / Ollama）。
21. **Walid-Amr/Restaurant-Ai-Agent**（n8n）— 餐厅点餐 AI 助手：n8n + OpenRouter + Google Sheets + Telegram，顾客用自然语言（任意语言）下单，AI 记忆上下文、确认订单并自动落表编号。
22. **varunmaheshwari30/telegram-expense-bot**（Google Apps Script）— AI 记账机器人：Google Apps Script + Claude Haiku + Google Sheets，无需服务器、无托管费用。
23. **z-mio/parse_hub_bot**（Python）— 多平台聚合解析机器人（把各平台分享链接解析成可直接查看的内容）。
24. **网易有道/LobsterAI**（桌面端）— 开源桌面级 AI 助手：数据分析、做 PPT、写文档、做视频、联网搜索；基于 OpenClaw，在本机跑工具，通过微信/飞书/钉钉/Telegram 从手机下指令。
25. **AntonLukjanov/mail-telegram-assistant**（Python）— Mail.ru 企业邮箱 → Telegram 助理，支持发件人白名单与 OpenRouter 处理。

## C. 群组 / 频道管理（13）

26. **leduchuong48-byte/telegram_chanel_manager_bot**（Python）— 群组/频道内容治理机器人：解决重复媒体堆积、历史回溯困难、规则分散；实时去重 + 历史扫描 + 标签处理 + Web 管理面板，把"监听-清洗-管理-追踪"整合成一条流程。
27. **leduchuong48-byte/telegram_autotgtoward**（Python）— WebUI 优先的自动转发 + RSS 运营平台：Setup Wizard、规则过滤、AI 处理、日志监控、Bot 控制，面向 NAS/HomeLab 长期运行。（Docker 镜像 leduchuong/telegram_chanel_autotoward 是同一项目的分发形式）
28. **ivanchik-byte/Telegram-Channel-Admin**（Python/aiogram3）— AI 驱动内容管理：解析"捐赠者"频道 → 过滤广告 → LLM（GPT）改写帖子 → 进入发布队列，发布前人工审核。
29. **vlymar1/channel-admin-bot**（Python）— 轻量频道管理机器人：管理频道里的内容与用户。
30. **alikm6/chToolsBot**（Python）— 面向频道管理员的小工具集机器人。
31. **mxvsh/modzero**（TS）— Telegram 管理平台，设计感强的控制面板，可在 Vercel 快速部署。
32. **TheHamkerCat/WilliamButcherBot**（Python/Pyrogram）— 经典群组管理机器人（反刷屏、admin 工具、blacklist 等）。
33. **Divkix/Alita_Robot**（Go/gotgbot）— 用 Go 重写的群管机器人，相比多数 Python 管理器更快更现代。
34. **ryukaizen/lucyna**（TS）— 群管机器人，grammY + GramJS（MTProto）组合，既能用 Bot API 也能用用户态能力做工具。
35. **Rachit-Pal/AlbedoBot**（Python）— 功能较全的综合型 Telegram 机器人。
36. **zero1max/Telegram-Announcement-Bot**（Python）— 公告机器人：用户提交公告 → 管理员审核批准/拒绝 → 通过的公告自动发到频道。
37. **redtidev1918/TelePost**（TS）— 频道投稿/审核/自动化发布平台：Bot + Mini App + 多 Bot + HTTP API，适合做 UGC 投稿频道。
38. **noob-mukesh/MukeshRobot**（Python）— 群管 + AI 二合一机器人，python-telegram-bot / telethon / pyrogram 混用，SQLAlchemy + MongoDB 存储。

## D. 转发 / 自动化 / Userbot（9）

39. **aahnik/tgcf**（Python）— "终极自定义转发工具"：实时同步器、自动发帖、备份机器人、频道克隆、聊天转发、消息复制，规则可完全自定义。（kjsssjj/tgcf 为分叉）
40. **Heavrnl/TelegramForwarder**（Python）— 功能强的消息转发器：多源转发、关键词过滤、正则替换、RSS 订阅、AI 处理、多平台推送。中文文档友好。
41. **PurpleSec/Forwarder**（Python）— 轻量 Telegram 帖子转发机器人。
42. **devgaganin/Auto-Forward-Bot-V2**（Python）— 高级消息/文件转发，能保存频道/群组里的受限（禁止转发）内容。
43. **Afdaan/telegram-webhook**（Python）— Telegram webhook 发送通道，用来把外部事件推给 bot。
44. **enzoemir1/n8n-telegram-approval**（n8n）— 给 n8n 工作流加"人在环"审批：通过 Telegram 按钮审批 AI 内容流水线 / 通用数据处理流程，工作流可导入即用。
45. **The-HellBot/HellBot**（Python）— 高性能 Telegram userbot（用户态自建机器人）。
46. **TeamPGM/PagerMaid-Pyro**（Python/Pyrogram）— 高级多功能 userbot，插件体系成熟。
47. **TeamPGM/PagerMaid-Modify**（Python/Telethon）— 同上，Telethon 版本。

## E. 电商 / 商店 / Mini App（14）

48. **ilyarolf/AiogramShopBot**（Python/Aiogram3 + Docker）— 开源 Telegram 电商机器人：卖虚拟与实物商品，加密货币支付，带推荐（referral）系统，功能最完整的"开箱即用发卡店"之一。
49. **JumpCodeFrog/telegram-shop-bot**（Go）— Go 写的商店机器人：商品目录、Telegram Stars & USDT 支付、订阅制、Mini App、管理面板。
50. **itzddos/ecommerce-telegram-bot**（Python）— Django + Aiogram：Django Admin 后台管理分类/子分类/商品，机器人含管理员端与客户端命令，带认证系统。
51. **raulpy271/telegram_ecommerce**（Python）— 商品销售机器人，销售员可自行增删改商品。
52. **interlumpen/Telegram-shop**（Python）— 商店模板：用户可充值余额、购买商品。
53. **interlumpen/Telegram-shop-Physical**（Python）— 实物商品版商店模板：下单 + 配送。
54. **DaniilDonskoy/Shop-bot**（Python）— 🛒 商店机器人模板，快速二次开发用。
55. **w1png/shop-telegram-bot**（Python）— 用于创建店铺的 Telegram 机器人（俄语文档）。
56. **unusdon/nova-store-telegram-mini-app**（HTML5/CSS3/原生 JS）— Telegram Mini App 电商 UI 套件：43 个店铺页 + 34 页后台，深浅色，EN/ES/AR(RTL)，4 种支付适配器（Telegram Stars / TON / Stripe / 货到付款），无构建步骤、配置优先。
57. **unusdon/nova-store-telegram-mini-app-nextjs**（Next.js 15 + React 19 + TS + Tailwind）— 上面那套的 Next.js 版本（免费姊妹版）：77 条路由（43 店铺 + 34 后台），同样多语言与多支付。**属于同一产品线，但仓库独立，按需取用。**
58. **mini-woo/mini-woo**（Next.js）— 把 WooCommerce 接进 Telegram Mini App，适合已有 WooCommerce 店铺的场景。
59. **kiran-venugopal/tgcart-mini-app**（JS）— 电商类 Telegram 小程序，曾在官方 Mini App 大赛获三等奖。
60. **bennyforweb4/farmtg-bot**（Python）— FarmTG Telegram 小程序自动化机器人（脚本类）。
61. **NishulDhakar/Telegram-Bots-Store**（Python）— "Bot 商店"：在一个地方发现/对比/使用多个 AI 机器人。

## F. 工具 / 文件 / 娱乐（8）

62. **csznet/tgState**（Go）— 把 Telegram 当对象存储用：文件外链系统，不限文件大小与格式。
63. **CodeXBotz/File-Sharing-Bot**（Python）— 文件分享机器人：存储帖子与文档，通过专属链接访问。
64. **GeiserX/paperless-telegram-bot**（Python）— 完全通过 Telegram 管理 Paperless-NGX：上传、搜索、打标签、整理文档。
65. **nuhmanpk/WebScrapper**（Python）— 网页抓取/爬虫机器人，号称"fast & easy"。
66. **deanxv/telegram-dice-bot**（Python）— 骰子娱乐机器人（群里掷骰子互动）。
67. **Milesden/durak_bot**（Python/aiogram）— 俄罗斯纸牌游戏 Durak 的对战机器人，异步 + 模块化架构。
68. **DuanNaiSheQu/cloudflare_temp_email**（TS）— Cloudflare 免费临时域名邮箱：免费收发、支持附件、IMAP/SMTP，带 TelegramBot 通知。
69. **vlymar1/Hamster-code-generator**（Python）— Hamster Kombat 促销码生成/分发机器人，含管理面板与用户通知系统。

## G. 营销 / 群发 / 高风险类（13）

> ⚠️ 这一组基本都违反 Telegram ToS（未授权群发、拉人、注册自动化），账号封禁风险高，还可能踩当地反垃圾/隐私法律。仅作"历史里出现过"的记录，不建议在生产号上使用。

70. **erfan4lx/Telegram-Mass-DM-Sender**（Python）— 向目标群组成员批量私信（Mass DM）。
71. **erfan4lx/Telegram-Bulk-Message-Sender**（Python）— 上一项的 Pro 版：多账号批量发信。
72. **AmrNabil12/Telegram-Bulk-Sender**（Python）— 基于 Telegram Web 自动化的群发：投递校验、媒体支持、重试、拟人化交互。
73. **BagroDeRose/TelegramMassSender**（Python）— Windows 桌面群发管理工具，PySide6 + qasync + Telethon。
74. **Ziadtareks/TeleSender-Telegram-Groups-Auto-Sender**（Python）— 群组自动群发：自动删除、循环重发、FloodWait 处理。
75. **nexusquanthq-art/telegram-sender**（Python）— GUI 发送工具：消息/图片/视频/文档。
76. **sajjad-021/Telegram-Marketing-Software**（Python）— 营销全家桶：群成员提取、自动回复、数据导出、广告投放等。
77. **free-985211/telegram-sender**（Python/易用向）— 中文群发工具集：群发、群组采集、自动加群、云控助手。
78. **Telegram-Tools-Free/Telegram-Member-Adder-Free**（Python）— 免费拉人（Member Adder）工具。
79. **HermanoPiedra/TelegramSender**（Python）— Replit 上的发送脚本仓库。
80. **lavalarkcorridor/Free-Telegram-Autoreg-Toolkit**（Python）— 免费 Telegram 自动注册工具箱（风险最高的一类）。
81. **DuanNaiSheQu/Telegram-bot**（聚合型）— 号称 Telegram 机器人源码平台/开源社区，实为资源分发聚合。
82. **DuanNaiSheQu/-telegram**（JS）— telegram 哈希百家乐（赌博类源码）。

## H. Awesome / 导航 / 资源列表（7）

83. **erkcet/awesome-telegram-bots**（持续维护）— Bot 资源精选：库、框架、工具、Mini App、社区 bot。
84. **telegram-bot-sdk/awesome-telegram-bots**— 用 Telegram Bot SDK(PHP) 构建的 Bot 精选。
85. **ebertti/awesome-telegram**— 群组、频道、机器人、库的合集。
86. **telegram-mini-apps-dev/awesome-telegram-mini-apps**— Telegram Mini Apps (TMA) 相关精选，做小程序必看。
87. **DOS-AI-Tech/Awesome-Telegram-Chinese-2026**— 2026 中文电报群/频道/机器人导航大全，聚合 AI、跨境出海、实用工具类中文群。
88. **EdmenGU/telegram-groups**— 从 5000+ 个电报群/频道/机器人里筛出的优质推荐。
89. **itgoyo/TelegramBot**— 中文圈收集最全的"Telegram 机器人大全"。

---

## 已排除的非开源 / 非项目内容

- **官方文档/入口**：core.telegram.org（Bot API、MTProto、Payments、Mini Apps、Bot Features 等）、telegram.org、my.telegram.org、core.telegram.org/bots、Telegram FAQ
- **商业 SaaS / 未开源**：Botpress、Bika.ai、mavibot.ai、Graspil、Avelina AI、RedClaw、BotLaunch、Postly、Nuelink、Publer、Combot、Mava、telegrambotlist.com
- **营销服务站（非开源）**：feiteapp.com、tgtoolone.com、erfan4lx.com、holly.ink
- **Demo / 部署实例（非项目）**：云梦家纺 store.zb-j.com / store.imtx.live / trycloudflare 实例、Nova Store 的 netlify 演示、localhost:8001、ezBookkeeping(127.0.0.1:8081)
- **各类 t.me 群/机器人入口**：@aitiwen_bot、@MiniWooBot、@wbbsupport、@combot、@daisyxbot、@vinted_trackerbot、@graspil_bot 等

---

## 去重说明（历史中重复出现次数最多的条目）

| 条目 | 历史中出现次数 |
|---|---|
| python-telegram-bot/python-telegram-bot | 4+ |
| leduchuong48-byte/telegram_chanel_manager_bot | 5+ |
| DOS-AI-Tech/Awesome-Telegram-Chinese-2026 | 3 |
| aiogram/aiogram、telegraf/telegraf | 各 3 |
| aahnik/tgcf（含 kjsssjj 分叉） | 4 |
| ivanchik-byte/Telegram-Channel-Admin | 5 |
| langbot-app/LangBot（含 kjsssjj 分叉） | 4 |
| unusdon/nova-store-* 系列 | 8+ |
| 云梦家纺（同一 Demo 的多个域名） | 6+ |

## 值得优先看的 10 个

| 需求 | 推荐 |
|---|---|
| 起一个 Bot 项目 | aiogram / python-telegram-bot / telegraf |
| 多平台 AI 机器人平台 | LangBot、MuseBot |
| 频道内容治理 + AI 改写 | Telegram-Channel-Admin、telegram_chanel_manager_bot |
| 转发 / 同步 / RSS | tgcf、TelegramForwarder、telegram_autotgtoward |
| 开箱即用电商 | AiogramShopBot、telegram-shop-bot |
| Mini App 电商 | nova-store（原生版 / Next.js 版）、tgcart-mini-app |
| 文件外链 / 存储 | tgState、File-Sharing-Bot |
| 群管理 | Alita_Robot（Go）、WilliamButcherBot |
| 资源导航 | awesome-telegram-bots、awesome-telegram-mini-apps、DOS-AI-Tech/Awesome-Telegram-Chinese-2026 |
| n8n 低代码串联 | n8n-telegram-approval |

> 说明：以上功能描述来自浏览器历史里的搜索结果摘要 + 项目公开信息，我这边没有联网逐仓库核实。动手前建议先看各仓库的 README、最近提交时间和 License（尤其是 AGPL-3.0 的 NovaAgent、以及 G 类工具的封号风险）。
