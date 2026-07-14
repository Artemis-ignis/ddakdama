$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $root ".tools"
$releaseApi = "https://api.github.com/repos/openai/tunnel-client/releases/latest"
$headers = @{ "User-Agent" = "DdakDama-Tunnel-Setup" }

New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

$architecture = switch ($env:PROCESSOR_ARCHITECTURE) {
  "ARM64" { "arm64" }
  default { "amd64" }
}

Write-Host "Checking the latest official OpenAI tunnel-client release..."
$release = Invoke-RestMethod -Uri $releaseApi -Headers $headers
$version = [string]$release.tag_name
$assetName = "tunnel-client-$version-windows-$architecture.zip"
$asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
$sumAsset = $release.assets | Where-Object { $_.name -eq "SHA256SUMS.txt" } | Select-Object -First 1

if (-not $asset -or -not $sumAsset) {
  throw "The official Windows $architecture tunnel-client release asset was not found."
}

$versionDir = Join-Path $toolsDir "tunnel-client-$version"
$exePath = Join-Path $versionDir "tunnel-client.exe"
$currentExe = Join-Path $toolsDir "tunnel-client.exe"

if (-not (Test-Path -LiteralPath $exePath)) {
  $zipPath = Join-Path $toolsDir $assetName
  $sumPath = Join-Path $toolsDir "tunnel-client-SHA256SUMS.txt"

  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath
  Invoke-WebRequest -Uri $sumAsset.browser_download_url -OutFile $sumPath

  $checksumLine = Get-Content -LiteralPath $sumPath -Encoding UTF8 |
    Where-Object { $_ -match ([regex]::Escape($assetName) + '$') } |
    Select-Object -First 1
  if (-not $checksumLine) {
    throw "The official SHA-256 list does not contain $assetName."
  }

  $expected = ($checksumLine -split '\s+')[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "tunnel-client SHA-256 verification failed."
  }

  New-Item -ItemType Directory -Force -Path $versionDir | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $versionDir -Force
}

if (-not (Test-Path -LiteralPath $exePath)) {
  throw "tunnel-client.exe was not found after extraction."
}

Copy-Item -Force -LiteralPath $exePath -Destination $currentExe
$installedVersion = & $currentExe --version
Write-Host "Installed: $installedVersion"
Write-Output $currentExe
