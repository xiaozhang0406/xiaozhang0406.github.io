# 碎碎念的使用方式

展示页：`/moments/`。编辑页：`/moments/edit/`。

## 第一次连接

1. 本次功能需要先同步到 GitHub，并完成 GitHub Pages 构建。编辑页不会在云端尚未有碎碎念数据时直接写入。
2. 打开编辑页中的「连接 GitHub」，按链接创建 **Fine-grained personal access token**。
3. 资源所有者选择 `xiaozhang0406`。Repository access 选择 **Only select repositories**，仅勾选 `xiaozhang0406.github.io`。
4. Repository permissions 中只需 **Contents: Read and write**；Metadata 的读取权限由 GitHub 自动包含。无需给其他仓库授权，也无需授予 Workflows 或管理权限。
5. 设置合适的有效期，将生成的凭据直接粘贴到编辑页连接。不要发到聊天、写进配置或提交到仓库。

凭据仅在该网页的内存中用于请求 `https://api.github.com`，不会写入 Cookie、localStorage、sessionStorage、碎碎念数据或 Git 提交；刷新和退出会清除连接。编辑页只加载本地脚本，并通过内容安全策略限制网络请求。连接时会核对 GitHub 账号为本博客所有者。

## 写一条

输入文字，可选择添加图片，也可只发图片。支持最多 4000 字、9 张 JPG / PNG / WebP / GIF 图片；单张最多 8 MB、合计最多 32 MB。预览不会上传任何内容。

点击「发布」后，网页自动附上发布时间，将文字与图片作为同一次 Git 提交保存到 `main`。GitHub Actions 随后使用现有流程生成并更新博客。**保存到仓库和线上部署完成是两个阶段**；保存成功后可点击「查看发布进度」。网络出错时编辑内容会保留；页面刷新前尚未发布的文字和图片只存在于当前页面。

展示页按北京时间显示时间，并按发布时间倒序、按月分组。图片可点击放大，支持系统深色模式切换和手机布局。碎碎念独立于文章列表、分类和归档。

本地编辑页也会发布到 GitHub；云端发布后，本地仓库仍需同步才能显示新记录。不要在本地预览发布测试内容来验证页面，自动化测试使用的是离线模拟。

## 内容保存位置

- 文字、时间与图片说明：`source/_data/moments.json`。
- 图片：`source/img/moments/`。
- 每条记录有独立标识，失败后重试可识别已经保存的记录；仓库同时被更新时会读取最新内容后重试，并保留其他记录。
- Git 提交保留历史。该功能不提供删除历史图片或强制覆盖分支的操作。

## 开发检查

`npm run test:moments` 覆盖文字发布、配图发布、仅图片发布、并发更新、网络响应丢失、账号限制、凭据退出及数据校验。`npm run build` 生成页面。

发布使用 GitHub 官方的 [Git Trees API](https://docs.github.com/en/rest/git/trees)、[Git References API](https://docs.github.com/en/rest/git/refs#update-a-reference) 和 [Fine-grained token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) 权限机制。
