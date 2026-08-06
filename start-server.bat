@echo off
chcp 65001 >nul
cd /d d:\blog\xiaozhang0406.github.io

echo.
echo ╔══════════════════════════════╗
echo ║   Yarinaoshi 博客本地预览   ║
echo ╚══════════════════════════════╝
echo.

echo [1/2] 检查依赖...
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
)

echo [2/2] 启动本地服务器...
echo.
echo 服务器启动后打开浏览器访问：
echo.
echo    http://localhost:4001
echo.
echo 按 Ctrl+C 停止服务器
echo ─────────────────────────────────
echo.

npx hexo server -p 4001

pause
