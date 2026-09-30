# Yarinaoshi 的 Memory 博客

正式站点：<https://yarinaoshi.top/>。

基于 [LinMoQC/Memory-Blog](https://github.com/LinMoQC/Memory-Blog) 的 `d9604241e2c6c55c66fcb9f37df87232fecf23da` 版本，保留首页布局、文章卡片、猫咪与主题切换动画。头像、介绍、文章、友链和碎碎念使用 Yarinaoshi 的内容。

## 内容与发布

个人资料在 `site.json`。文章继续编辑仓库根目录的 `source/_posts/`，友链在 `source/_data/link.yml`。`published: false` 或 `draft: true` 的文章不会发布。

碎碎念从 `source/_data/moments.json` 读取，在 `/moments/edit/` 使用已有的 GitHub 登录服务发布文字和图片。发布服务写入这个仓库的 `main` 分支，随后 GitHub Actions 自动更新站点。

根目录运行 `npm ci` 和 `npm ci --prefix memory-blog` 后，使用 `npm run build` 构建、`npm run check:memory` 检查。构建先生成 Hexo 的内容路径和静态资源，再装配 Memory 页面，保留 `/posts/.../`、`/archives/`、`/about/`、`/link/` 和 `/moments/` 等地址。所有公开页面都有独立 HTML 入口，可直接打开或刷新。

在此目录使用 `npm run dev` 可开发预览，默认地址 `http://127.0.0.1:4173/`。完整站点的本地检查应使用根目录构建后的 `public/`。

Memory Core 管理后台、AI 服务和友链在线申请没有接入。现有碎碎念登录和发布服务独立运行，无需 Memory Core 数据库。

## 来源与回退

原作者为林陌青川 / LinMoQC，遵循 GNU GPL v2，许可证在 `LICENSE`，页脚保留来源。修改后的源代码随博客仓库公开。

换模板前的生产版本是 `4d1aed39b8bcb3835e082bc3e8cd55c2d8f7f7ce`，本地分支 `backup/before-memory-20260930` 指向该版本；旧主题源文件和文章仍保留在仓库中。需要回退时，撤销此次模板迁移提交并重新发布。
