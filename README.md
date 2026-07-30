# Yarinaoshi 的技术博客

基于 **Hexo** + **Butterfly** 主题搭建的个人技术博客。

🔗 [yarinaoshi.top](https://yarinaoshi.top)

## 技术栈

- **框架**: [Hexo](https://hexo.io/) 5.x
- **主题**: [Butterfly](https://butterfly.js.org/)
- **部署**: GitHub Pages + GitHub Actions
- **评论**: Giscus

## 本地开发

```bash
# 安装依赖
npm install

# 启动本地预览
npx hexo server

# 生成静态文件
npx hexo generate

# 新建文章
npx hexo new "文章标题"
```

## 文章 Front Matter 示例

```yaml
---
title: 文章标题
date: 2026-07-30 09:00:00
categories: 分类名
tags: [标签1, 标签2]
description: 文章描述
---
```

## 目录结构

```
source/
├── _posts/          # 文章
├── about/           # 关于页面
├── categories/      # 分类页面
├── tags/            # 标签页面
├── archives/        # 归档页面
├── img/             # 图片资源
└── CNAME            # 自定义域名
```

## 回滚

如需回滚到 Jekyll Chirpy 版本，请参考 `backup/RECOVERY.md`。
