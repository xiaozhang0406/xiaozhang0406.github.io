# 碎碎念

展示页：`/moments/`。编辑页：`/moments/edit/`。

博主在手机或电脑打开编辑页，点击「使用 GitHub 登录」，在 GitHub 窗口完成登录后即可发布。编辑中的文字和图片会留在原窗口。刷新页面后仍可在同一设备上使用登录状态；服务重启会清除会话，需要再点一次登录。退出只清除当前设备的发布会话。网页不会要求粘贴个人访问令牌，也不会收到 GitHub 授权令牌。

文字、图片、UTC 发布时间和说明仍写入博客仓库的 `source/_data/moments.json` 与 `source/img/moments/`，GitHub Actions 随后生成网站。保存成功与线上页面更新是两个阶段。失败时编辑框内容保留。每条最多 4000 字、9 张 JPG/PNG/WebP/GIF 图片；单张最多 8 MB，总量最多 32 MB。仅图片也可以发布。

## 一次性启用网页登录

服务运行在现有服务器的 `planner.yarinaoshi.top/moments-api` 路径。它只监听本机回环地址，Caddy 提供 HTTPS。初次部署后，打开私有配置链接，在 GitHub 创建应用；应用请求 **Contents: Read and write**，不订阅 webhook。安装时选择 **Only select repositories**，仅勾选 `xiaozhang0406.github.io`。配置流程会校验应用创建者的 GitHub 数字账号 ID，仅把 client ID 和 client secret 写到服务器的私有文件（权限 0600），不保留自动生成的私钥或 webhook secret。应用保持 private。

配置完成后，在编辑页用 GitHub 登录一次。服务端再次核对登录账号的数字 ID、仓库 ID 和写入权限；只允许写入固定博客仓库的碎碎念数据与图片。GitHub 用户令牌和刷新令牌仅在服务进程内存中保存，并由服务端自动续期。服务进程重启后需重新登录。

运行需要 Python 3.12，环境变量 `MOMENTS_APP_CONFIG` 指向私有应用配置文件，`MOMENTS_SETUP_KEY` 是仅用于首次创建应用的随机密钥，`MOMENTS_PORT` 默认为 13301。首次配置完成后，配置链接立即失效。服务器上应以独立 systemd 服务运行，只让 Caddy 把 `/moments-api/*` 转发到 `127.0.0.1:13301`。博客主页与其他服务器服务无需改动。

## 检查

`npm run test:moments` 覆盖旧版发布算法与新版服务端的文字、图片、重试、并发及无效数据；`npm run build` 生成页面。服务端 `/moments-api/health` 的 `ready` 表示 GitHub 应用是否已配置，不代表已经完成实际登录或发布。实际发布必须在博主登录后单独验收。

GitHub 登录使用官方 [GitHub App Web Application Flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app) 与 [Manifest 注册流程](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)。
