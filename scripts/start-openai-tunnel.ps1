param(
  [switch]$DoctorOnly
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $root ".tools"
$runDir = Join-Path $root ".run\tunnel-client"
$clientPath = Join-Path $toolsDir "tunnel-client.exe"
$profileName = "ddakdama-local"
$profilePath = Join-Path $runDir "$profileName.yaml"
$healthUrlFile = Join-Path $runDir "health-url.txt"
$secretPath = Join-Path $env:LOCALAPPDATA "DdakDama\secrets\tunnel-control-plane-key.dpapi"
$tunnelId = "tunnel_6a558b1cfec48191993a91062fa9f5e3"
$organizationId = "org-7lzC8zfq6aZmkKUwbMsveqxy"
$mcpUrl = "http://127.0.0.1:8787/mcp"

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8787/health" -TimeoutSec 3
  if (-not $health.ok -or $health.name -ne "ddakdama") {
    throw "The DdakDama server health response is invalid."
  }
}
catch {
  throw "The DdakDama server is not running. Start start-windows.bat first."
}

if (-not (Test-Path -LiteralPath $clientPath)) {
  & (Join-Path $PSScriptRoot "install-openai-tunnel-client.ps1") | Out-Null
}
if (-not (Test-Path -LiteralPath $clientPath)) {
  throw "tunnel-client installation failed."
}

if (-not (Test-Path -LiteralPath $secretPath)) {
  & (Join-Path $PSScriptRoot "setup-tunnel-key.ps1")
}
if (-not (Test-Path -LiteralPath $secretPath)) {
  throw "The tunnel-only API key is not configured."
}

New-Item -ItemType Directory -Force -Path $runDir | Out-Null
& $clientPath init `
  --profile $profileName `
  --profile-dir $runDir `
  --tunnel-id $tunnelId `
  --mcp-server-url $mcpUrl `
  --health-listen-addr "127.0.0.1:0" `
  --force | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "The tunnel-client profile could not be created."
}

$secureKey = Get-Content -Raw -Encoding UTF8 -LiteralPath $secretPath | ConvertTo-SecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:CONTROL_PLANE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $env:CONTROL_PLANE_ORGANIZATION_ID = $organizationId

  Write-Host "Checking the OpenAI Secure MCP Tunnel configuration..."
  & $clientPath doctor --profile $profileName --profile-dir $runDir --explain
  if ($LASTEXITCODE -ne 0) {
    throw "Tunnel preflight failed. Review the error above."
  }

  if ($DoctorOnly) {
    Write-Host "Tunnel preflight passed."
    return
  }

  if (Test-Path -LiteralPath $healthUrlFile) {
    Remove-Item -Force -LiteralPath $healthUrlFile
  }

  Write-Host ""
  Write-Host "Starting the DdakDama OpenAI Secure MCP Tunnel."
  Write-Host "Keep this window open while using the ChatGPT app."
  Write-Host "No browser tabs will be opened automatically."
  & $clientPath run `
    --profile $profileName `
    --profile-dir $runDir `
    --health.listen-addr "127.0.0.1:0" `
    --health.url-file $healthUrlFile
  if ($LASTEXITCODE -ne 0) {
    throw "tunnel-client exited with code $LASTEXITCODE."
  }
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  Remove-Item Env:CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:CONTROL_PLANE_ORGANIZATION_ID -ErrorAction SilentlyContinue
}
