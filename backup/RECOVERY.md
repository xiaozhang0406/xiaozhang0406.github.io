# 博客回滚指南 | Blog Rollback Guide

## 快照信息

- **备份时间**: 2026-07-30
- **原框架**: Jekyll + Chirpy v7.6
- **Git HEAD**: 60e3df1
- **Git 分支**: main

---

## 完全回滚步骤（恢复到 Jekyll Chirpy）

### 方法一：从 backup 文件夹恢复（推荐）

```bash
# 1. 删除当前所有 Hexo 文件（保留 backup 和 .git）
find . -not -path './.git/*' -not -path './.git' -not -path './backup/*' -not -name 'backup' -not -name '.git' -maxdepth 1 -exec rm -rf {} +

# 2. 把 backup 里的内容复制到根目录
cp -r backup/* ./
rm -rf backup/_config.yml  # 避免覆盖后还有残留

# 实际上更简单的方式：
# 删除除 backup 和 .git 外的所有文件
rm -rf _posts _tabs _data _plugins assets tools index.html Gemfile Gemfile.lock _config.yml .github .gitattributes LICENSE README.md node_modules package.json package-lock.json _config.butterfly.yml _config.hexo.yml source scaffolds

# 然后把 backup 内容全部复制出来
cp -r backup/* ./backup/.[^.]* ./ 2>/dev/null
cp -r backup/.github ./ 2>/dev/null
cp -r backup/.gitattributes ./ 2>/dev/null

# 3. 安装 Jekyll 依赖
bundle install

# 4. 本地测试
bundle exec jekyll s

# 5. 提交恢复
git add -A
git commit -m "rollback: 恢复到 Jekyll Chirpy"
git push origin main
```

### 方法二：从 Git 历史恢复

```bash
# 回退到快照时的 commit
git checkout 60e3df1 -- .

# 或者直接 reset
git reset --hard 60e3df1
git push --force origin main
```

### 恢复完之后

删除 backup 文件夹：
```bash
rm -rf backup
git add -A && git commit -m "chore: remove backup folder"
```

---

## 原 Jekyll 项目结构

```
.
├── .github/workflows/pages-deploy.yml
├── _config.yml              # Jekyll + Chirpy 配置
├── _data/
│   ├── contact.yml
│   ├── locales/zh-CN.yml
│   └── share.yml
├── _plugins/posts-lastmod-hook.rb
├── _posts/
│   ├── 2026-07-22-hello-world.md
│   ├── 2026-07-26-hello-yarinaoshi.md
│   └── 2026-07-27-Linux-Learning-Note.md
├── _tabs/
│   ├── about.md
│   ├── archives.md
│   ├── categories.md
│   └── tags.md
├── assets/img/
│   ├── avatar.png
│   └── favicons/
├── Gemfile
├── index.html
└── tools/
    ├── deploy.ps1
    ├── deploy.sh
    ├── run.sh
    └── test.sh
```
