param(
    [string]$Message = "",
    [string]$Branch = "main"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne $Branch) {
    Write-Error "当前分支是 '$currentBranch'，请切换到 $Branch 分支再部署。"
    exit 1
}

$status = git status --porcelain
if ($status) {
    Write-Host "检测到未提交更改，正在暂存所有文件。"
    git add -A
}

if (-not $Message) {
    $Message = "Auto deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

$staged = git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { $hasStaged = $true } else { $hasStaged = $false }
if ($hasStaged) {
    git commit -m $Message
} else {
    Write-Host "没有新的更改可提交。"
}

git push origin $Branch
Write-Host "已推送到 origin/$Branch。GitHub Actions 将自动触发部署。"
