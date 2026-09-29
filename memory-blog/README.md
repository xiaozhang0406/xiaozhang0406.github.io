# Yarinaoshi 的 Memory 模板预览

这是 [LinMoQC/Memory-Blog](https://github.com/LinMoQC/Memory-Blog) 的个人化预览，基于上游 `d9604241e2c6c55c66fcb9f37df87232fecf23da`。保留原模板的首页布局、文章卡片、猫咪与主题切换动画，替换为 Yarinaoshi 的头像、介绍和公开内容。

## 分支与部署

源代码位于原博客仓库的 `preview/memory-blog` 分支，目录为 `memory-blog/`。原博客 `main` 分支保持不变。

独立预览使用 GitHub Pages 项目站点，路径为 `/yarinaoshi-memory-preview/`。GitHub Pages 会沿用账号主站的自定义域名，预计正式地址为 `https://yarinaoshi.top/yarinaoshi-memory-preview/`，以实际部署验证结果为准。部署仓库只保存构建产物、许可证和来源记录，不包含隐藏笔记。预览采用 HashRouter，文章、归档、友链、关于和碎碎念页面的链接可直接打开或刷新。

## 个性化资料

编辑 `site.json`。当前资料取自原博客的配置、关于页与公告，包括学校、专业、年级、项目、GitHub、邮箱、QQ 和备案号。未自动推断新的学历或项目成果。

构建时 `scripts/prepare-content.mjs` 读取同一分支的 `source/_posts/`、`source/_data/link.yml` 和 `source/_data/moments.json`。`published: false` 或 `draft: true` 的文章排除，文章 Markdown 正文保持原样。个人资料和数据为构建时快照。

## 本地构建

```powershell
cd memory-blog
npm ci
npm run build
npm run check:content
npm run preview
```

本地地址为 `http://127.0.0.1:4173/yarinaoshi-memory-preview/`。使用其他部署路径时，可设置 `MEMORY_BASE_PATH` 后构建。

## 本次可用范围

已适配公开文章阅读、归档与分类、正文搜索、友链、互动个人介绍、深浅色模式及手机布局。碎碎念显示本分支已有记录，发布入口链接到现有博客的编辑页。

原模板的 Spring Boot 登录、管理后台、友链在线申请和 AI 调用没有接入，预览不会提供假登录或假保存。完整后台需要另外部署 Memory Core 及其数据库。网站预览不包含任何凭据或 API 密钥。

## 许可与来源

模板原作者为林陌青川 / LinMoQC。原代码依照 GNU GPL v2 使用，许可证见 `LICENSE`。预览的修改源代码公开于原博客的预览分支；页面页脚保留模板来源。
