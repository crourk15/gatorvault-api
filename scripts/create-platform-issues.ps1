# Creates four P0 platform alignment issues on GitHub.
# Requires: GitHub CLI — winget install GitHub.cli
# Usage: .\scripts\create-platform-issues.ps1 [-DryRun]

param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$Repo = "crourk15/gatorvault-api"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$IssuesDir = Join-Path $Root "docs\github-issues"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "GitHub CLI (gh) not found." -ForegroundColor Yellow
  Write-Host "Install: winget install GitHub.cli"
  Write-Host ""
  Write-Host "Alternative: push this branch, then use GitHub issue templates at:"
  Write-Host "  https://github.com/$Repo/issues/new/choose"
  Write-Host ""
  Write-Host "Issue bodies are in: docs/github-issues/"
  exit 1
}

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: gh auth login" -ForegroundColor Yellow
  exit 1
}

$files = @(
  "01-portal-headliner.md",
  "02-articles-pipeline.md",
  "03-depth-chart.md",
  "04-film-room.md"
)

foreach ($file in $files) {
  $path = Join-Path $IssuesDir $file
  if (-not (Test-Path $path)) {
    Write-Host "Missing $path" -ForegroundColor Red
    continue
  }
  $raw = Get-Content $path -Raw
  if ($raw -match '(?m)^#\s+(.+)$') { $title = $Matches[1].Trim() } else { $title = $file }
  $body = ($raw -replace '(?ms)^#\s+.+\r?\n', '').Trim()

  Write-Host "---"
  Write-Host "Title: $title"
  if ($DryRun) {
    Write-Host "(dry run — not creating)"
    continue
  }
  gh issue create --repo $Repo --title $title --body $body --label "P0" --label "brand-critical"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create issue for $file (labels may not exist yet — retry without labels or create labels in repo settings)" -ForegroundColor Yellow
    gh issue create --repo $Repo --title $title --body $body
  }
}

Write-Host ""
Write-Host "Done. View issues: https://github.com/$Repo/issues"
