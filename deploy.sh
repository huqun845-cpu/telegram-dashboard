#!/usr/bin/env bash
#
# 把「Telegram 开源项目看板」发布到外网，永久免费。
#
#   用法:  ./deploy.sh <平台>
#
#     gh           GitHub Pages      → https://<你的用户名>.github.io/telegram-dashboard/
#     cloudflare   Cloudflare Pages  → https://telegram-dashboard.pages.dev/
#     netlify      Netlify           → https://<随机名>.netlify.app/
#     vercel       Vercel            → https://telegram-dashboard.vercel.app/
#     surge        Surge.sh          → https://telegram-dashboard.surge.sh/
#
#   改站点名:  SITE_NAME=my-site ./deploy.sh gh
#
# 首次运行会要求登录对应平台（浏览器点一下即可），之后这台机器上永久免登录。
#
set -euo pipefail
cd "$(dirname "$0")"

SITE_NAME="${SITE_NAME:-telegram-dashboard}"
DESC="Telegram 开源项目调研看板：89 个项目的活跃度/许可证/商用性可视化筛选"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✅ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m⚠️  %s\033[0m\n' "$*"; }
die()  { printf '\033[31m❌ %s\033[0m\n' "$*" >&2; exit 1; }

# 发布前先跑一遍测试，避免把坏数据推上去
preflight() {
  bold "▶ 发布前自检"
  node test.mjs 2>&1 | tail -3 || die "测试没通过，先修 bug 再发布（想强行发布：SKIP_TEST=1 ./deploy.sh $PLATFORM）"
  [ -f index.html ] || die "缺少 index.html"
  ok "自检通过，开始发布到 $PLATFORM"
}

PLATFORM="${1:-}"
[ -z "$PLATFORM" ] && { sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

if [ "${SKIP_TEST:-0}" != "1" ]; then preflight; else warn "SKIP_TEST=1，跳过自检"; fi

case "$PLATFORM" in

# ─────────────────────────────────────────────────────────────
gh)
  command -v gh >/dev/null || die "没装 gh。装法：brew install gh"
  gh auth status >/dev/null 2>&1 || die "请先登录：gh auth login   （选 GitHub.com → HTTPS → 用浏览器登录）"

  USER_NAME=$(gh api user -q .login)
  git rev-parse --git-dir >/dev/null 2>&1 || { git init -q -b main 2>/dev/null || { git init -q; git branch -M main 2>/dev/null || true; }; }

  # 防雷：Surge 部署会生成 CNAME，一旦提交，GitHub Pages 会把默认域名 301 到 surge
  if git ls-files --error-unmatch CNAME >/dev/null 2>&1; then
    warn "CNAME 被 git 跟踪了，自动移除（否则 Pages 默认域名会被带偏）"
    git rm --cached CNAME -q
  fi

  git add -A
  git commit -qm "deploy: 更新看板数据 $(date +'%Y-%m-%d %H:%M')" 2>/dev/null || true

  if git remote get-url origin >/dev/null 2>&1; then
    gh auth setup-git >/dev/null 2>&1 || true   # 让 git 复用 gh 的凭证，否则会卡在输密码
    git push origin main || die "推送失败。检查：gh auth status / gh auth setup-git"
    ok "已推送到已有仓库"
  else
    gh auth setup-git >/dev/null 2>&1 || true
    gh repo create "$SITE_NAME" --public --source=. --remote=origin --push --description "$DESC" || die "创建仓库失败"
    ok "已创建公开仓库 $USER_NAME/$SITE_NAME 并推送"
  fi

  # 开启 GitHub Pages（已开启会报 409，忽略）
  gh api -X POST "repos/$USER_NAME/$SITE_NAME/pages" \
      -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true

  URL="https://$USER_NAME.github.io/$SITE_NAME/"
  ok "GitHub Pages 已开启"
  echo
  bold "🌐 永久地址：$URL"
  warn "首次部署要等 1~2 分钟构建，之后每次跑本命令约 30 秒生效"
  ;;

# ─────────────────────────────────────────────────────────────
cloudflare)
  bold "▶ Cloudflare Pages（免费无限流量，全球 CDN）"
  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    warn "还没登录。下面会打开浏览器，点「Allow」授权即可"
    npx --yes wrangler@latest login
  fi
  npx --yes wrangler@latest pages deploy . --project-name="$SITE_NAME" --commit-dirty=true
  echo
  bold "🌐 永久地址：https://$SITE_NAME.pages.dev/"
  ;;

# ─────────────────────────────────────────────────────────────
netlify)
  bold "▶ Netlify"
  npx --yes netlify-cli@latest deploy --prod --dir=. --message "更新看板数据"
  echo
  bold "🌐 上面的 Website URL 就是永久地址（可自行改名）"
  ;;

# ─────────────────────────────────────────────────────────────
vercel)
  bold "▶ Vercel"
  npx --yes vercel@latest deploy --prod --yes
  echo
  bold "🌐 上面的 Production 地址就是永久地址"
  ;;

# ─────────────────────────────────────────────────────────────
surge)
  bold "▶ Surge.sh（最简单，纯 CLI 注册）"
  npx --yes surge@latest . "$SITE_NAME.surge.sh"
  echo
  bold "🌐 永久地址：https://$SITE_NAME.surge.sh/"
  ;;

# ─────────────────────────────────────────────────────────────
*)
  die "未知平台：$PLATFORM   可选：gh | cloudflare | netlify | vercel | surge"
  ;;
esac

echo
bold "✅ 完成。本地预览：open index.html"
