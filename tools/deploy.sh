#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "Error: 当前分支是 '$branch'，请切换到 main 再部署。"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "检测到未提交更改，正在暂存所有文件。"
  git add -A
fi

commit_message="${1:-Auto deploy: $(date +'%Y-%m-%d %H:%M:%S')}"
if ! git diff --cached --quiet; then
  git commit -m "$commit_message"
else
  echo "没有新的更改可提交。"
fi

git push origin main

echo
 echo "已推送到 origin/main。GitHub Actions 将自动触发部署。"
