#!/usr/bin/env bash
#
# 一键刷新看板数据并发布：
#
#   抓取 GitHub 真实数据  →  烘焙进 data.js  →  跑回归测试  →  发布到线上
#
#   用法:  ./refresh.sh                 # 完整流程
#          ./refresh.sh --no-deploy     # 只更新本地数据，不发布
#          ./refresh.sh --dry-run       # 只抓取 + 预览改动，不写盘不发布
#
#   用 gh 的 OAuth token 认证，配额 5000/h，88 个仓库一次抓完（约 10 秒）。
#
set -uo pipefail
cd "$(dirname "$0")"

NO_DEPLOY=0
DRY_RUN=0
for a in "$@"; do
  case "$a" in
    --no-deploy) NO_DEPLOY=1 ;;
    --dry-run)   DRY_RUN=1 ;;
    -h|--help)   sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  esac
done

LOG="refresh.log"
STAMP=$(date '+%Y-%m-%d %H:%M:%S')
# 同时写日志和终端（cron 里也能留下痕迹）
exec > >(tee -a "$LOG") 2>&1

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✅ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m⚠️  %s\033[0m\n' "$*"; }
bad()  { printf '\033[31m❌ %s\033[0m\n' "$*"; }

bold "════════ 刷新开始 $STAMP ════════"

# ── 0. 认证（未认证只有 60 次/小时，抓不完 88 个）────────────────
if [ -z "${GITHUB_TOKEN:-}" ]; then
  if command -v gh >/dev/null 2>&1 && GH_TOKEN_TMP=$(gh auth token 2>/dev/null) && [ -n "$GH_TOKEN_TMP" ]; then
    export GITHUB_TOKEN="$GH_TOKEN_TMP"
    ok "已用 gh 的凭证认证（配额 5000/小时）"
  else
    warn "没有可用 token，降级为未认证模式（60 次/小时，本次最多抓 55 个）"
  fi
fi

BEFORE=$(shasum -a 256 data.js meta.json 2>/dev/null | shasum -a 256 | cut -c1-12)

# ── 1. 抓取 ──────────────────────────────────────────────────
bold "▶ [1/4] 抓取 GitHub 真实数据"
if [ -z "${GITHUB_TOKEN:-}" ]; then
  node fetch-github-meta.mjs --limit=55 || { bad "抓取失败"; exit 1; }
else
  node fetch-github-meta.mjs || { bad "抓取失败"; exit 1; }
fi

# ── 2. 烘焙 ──────────────────────────────────────────────────
bold "▶ [2/4] 烘焙进 data.js"
if [ "$DRY_RUN" = "1" ]; then
  node bake-meta.mjs --check || bad "空跑异常"
  warn "dry-run：跳过写盘与发布"
  exit 0
fi
node bake-meta.mjs || { bad "烘焙失败（data.js 已自动回滚）"; exit 1; }

AFTER=$(shasum -a 256 data.js meta.json 2>/dev/null | shasum -a 256 | cut -c1-12)

# ── 3. 测试 ──────────────────────────────────────────────────
bold "▶ [3/4] 回归测试"
TEST_OUT=$(node test.mjs 2>&1)
printf '%s\n' "$TEST_OUT" | tail -3
if printf '%s' "$TEST_OUT" | grep -qE "结果：[0-9]+ 通过 / 0 失败"; then
  ok "测试全通过"
else
  bad "测试未全部通过，拒绝发布。失败详情："
  printf '%s\n' "$TEST_OUT" | grep -aE "✗|失败" | head -20
  exit 1
fi

# ── 4. 发布 ──────────────────────────────────────────────────
if [ "$NO_DEPLOY" = "1" ]; then
  warn "指定了 --no-deploy，跳过发布"
  exit 0
fi

if [ "$BEFORE" = "$AFTER" ]; then
  ok "数据无变化（data.js / meta.json 校验和一致），跳过发布"
  bold "════════ 刷新结束（无变更）════════"
  exit 0
fi

bold "▶ [4/4] 发布到线上"
./deploy.sh gh    || bad "GitHub Pages 发布失败"
SKIP_TEST=1 ./deploy.sh surge || bad "Surge 发布失败"

bold "════════ 刷新结束 ✅ ════════"
