param(
  [string]$PublicOrigin = $env:DDAKDAMA_PUBLIC_ORIGIN,
  [switch]$SkipFullChecks
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function Get-NormalizedHttpsOrigin([string]$Value) {
  $uri = $null
  if (-not $Value -or -not [Uri]::TryCreate($Value.Trim(), [UriKind]::Absolute, [ref]$uri)) {
    throw "A valid public origin was not found in the deploy output. Set DDAKDAMA_PUBLIC_ORIGIN and run again."
  }
  if ($uri.Scheme -ne "https" -or $uri.IsLoopback) {
    throw "The public origin must be a non-loopback HTTPS URL."
  }
  return $uri.GetLeftPart([UriPartial]::Authority).TrimEnd('/')
}

Write-Host "Deploying the DdakDama public service..." -ForegroundColor White
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$deployCommand = 'pnpm --filter @ddakdama/worker run deploy 2>&1'
& $env:ComSpec /d /s /c $deployCommand | Tee-Object -Variable capturedDeploy
$deployExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($deployExitCode -ne 0) {
  $deployText = ($capturedDeploy | ForEach-Object { $_.ToString() }) -join "`n"
  if ($deployText -match "verify your email address|code:\s*10034") {
    throw "Cloudflare email verification is still required. Open https://dash.cloudflare.com/profile, verify the account email, and run this file again."
  }
  throw "Cloudflare Worker deployment failed with exit code $deployExitCode"
}

$deployText = ($capturedDeploy | ForEach-Object { $_.ToString() }) -join "`n"
if (-not $PublicOrigin) {
  $matches = [regex]::Matches($deployText, 'https://[a-zA-Z0-9.-]+\.workers\.dev')
  if ($matches.Count -gt 0) {
    $PublicOrigin = $matches[$matches.Count - 1].Value
  }
}
$PublicOrigin = Get-NormalizedHttpsOrigin $PublicOrigin
Write-Host "Public origin: $PublicOrigin" -ForegroundColor Green

Write-Host ""
Write-Host "==> Public health check" -ForegroundColor Cyan
$health = $null
for ($attempt = 1; $attempt -le 10; $attempt++) {
  try {
    $healthJson = & curl.exe --fail --silent --show-error --max-time 10 "$PublicOrigin/health"
    if ($LASTEXITCODE -ne 0) { throw "curl health check failed" }
    $health = $healthJson | ConvertFrom-Json
    if ($health.ok) { break }
  }
  catch {
    if ($attempt -eq 10) { throw }
  }
  Start-Sleep -Seconds 3
}
if (-not $health -or -not $health.ok) {
  throw "The deployed /health endpoint did not report ok=true."
}

$env:DDAKDAMA_TEST_ORIGIN = $PublicOrigin
Invoke-Checked "Public MCP smoke test" { node apps/server/tests/mcp-smoke.mjs }
Invoke-Checked "Public multi-user isolation test" { node apps/server/tests/mcp-multiuser-smoke.mjs }

if (-not $SkipFullChecks) {
  Invoke-Checked "Lint" { pnpm lint }
  Invoke-Checked "Typecheck" { pnpm typecheck }
  Invoke-Checked "Unit and integration tests" { pnpm test }
  Invoke-Checked "Browser fixture tests" { pnpm test:e2e }
  Invoke-Checked "Dependency audit" { pnpm audit --audit-level high }
}

$env:VITE_DDAKDAMA_SERVER_ORIGIN = $PublicOrigin
Invoke-Checked "Build and package" { pnpm package }

& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "verify-public-package.ps1") -PublicOrigin $PublicOrigin
if ($LASTEXITCODE -ne 0) {
  throw "Public package verification failed with exit code $LASTEXITCODE"
}

$releaseInfo = @(
  "DDAKDAMA_PUBLIC_ORIGIN=$PublicOrigin"
  "DDAKDAMA_MCP_URL=$PublicOrigin/mcp"
  "DDAKDAMA_HEALTH_URL=$PublicOrigin/health"
  "DDAKDAMA_PRIVACY_URL=$PublicOrigin/privacy"
  "DDAKDAMA_TERMS_URL=$PublicOrigin/terms"
  "DDAKDAMA_SUPPORT_URL=$PublicOrigin/support"
) -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $root "dist\PUBLIC_RELEASE_URLS.txt") -Value $releaseInfo -Encoding utf8

Write-Host ""
Write-Host "DdakDama public release is ready." -ForegroundColor Green
Write-Host "ChatGPT MCP URL: $PublicOrigin/mcp"
Write-Host "Extension ZIP: $(Join-Path $root 'dist\ddakdama-extension-v1.0.0.zip')"
Write-Host "Connection URLs: $(Join-Path $root 'dist\PUBLIC_RELEASE_URLS.txt')"
