$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
function Assert-StagingPath([string]$Path) {
  $rootFull = [IO.Path]::GetFullPath($root).TrimEnd([IO.Path]::DirectorySeparatorChar)
  $pathFull = [IO.Path]::GetFullPath($Path)
  if (-not $pathFull.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Packaging path is outside the workspace: $pathFull"
  }
}
$productionServerOrigin = $env:VITE_DDAKDAMA_SERVER_ORIGIN
$parsedServerOrigin = $null
if (-not $productionServerOrigin -or -not [Uri]::TryCreate($productionServerOrigin, [UriKind]::Absolute, [ref]$parsedServerOrigin) -or $parsedServerOrigin.Scheme -ne "https") {
  throw "Public packaging requires a stable HTTPS VITE_DDAKDAMA_SERVER_ORIGIN, for example https://ddakdama.example.workers.dev"
}
$env:VITE_DDAKDAMA_SERVER_ORIGIN = $parsedServerOrigin.GetLeftPart([UriPartial]::Authority).TrimEnd('/')
$env:VITE_DDAKDAMA_AFFILIATE_ENABLED = "false"
pnpm build
$out = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$version = "1.0.0"
$extensionZip = Join-Path $out "ddakdama-extension-v$version.zip"
$serverZip = Join-Path $out "ddakdama-server-v$version.zip"
$workerZip = Join-Path $out "ddakdama-cloudflare-worker-v$version.zip"
$chatgptZip = Join-Path $out "ddakdama-chatgpt-app-v$version.zip"
$fullZip = Join-Path $out "ddakdama-full-v$version.zip"
Get-ChildItem -LiteralPath $out -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "ddakdama-extension-dev-v*.zip" -or $_.Name -like "ddakdama-extension-webstore-v*.zip" } | Remove-Item -Force
$legacyInternal = Join-Path $out "internal"
Assert-StagingPath $legacyInternal
Remove-Item -LiteralPath $legacyInternal -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $extensionZip,$serverZip,$workerZip,$chatgptZip,$fullZip -Force -ErrorAction SilentlyContinue
$extensionStage = Join-Path $out "_extension"
Assert-StagingPath $extensionStage
Remove-Item -LiteralPath $extensionStage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $extensionStage | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\extension\dist") -Destination $extensionStage
Copy-Item -Recurse -Force (Join-Path $root "apps\extension\assets") -Destination $extensionStage
Copy-Item -Force (Join-Path $root "apps\extension\manifest.json") -Destination $extensionStage
$webstoreManifest = Get-Content (Join-Path $extensionStage "manifest.json") -Raw -Encoding utf8 | ConvertFrom-Json
$webstoreManifest.host_permissions = @($webstoreManifest.host_permissions | Where-Object { $_ -notmatch '^http://localhost:' })
$serverPermission = $parsedServerOrigin.GetLeftPart([UriPartial]::Authority).TrimEnd('/') + "/*"
$webstoreManifest.host_permissions = @($webstoreManifest.host_permissions + $serverPermission | Select-Object -Unique)
$webstoreManifest | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 (Join-Path $extensionStage "manifest.json")
$releaseMetadata = [ordered]@{
  version = $version
  distributionMode = "webstore"
  serverOrigin = $env:VITE_DDAKDAMA_SERVER_ORIGIN
  affiliateEnabled = $false
  builtAt = (Get-Date).ToUniversalTime().ToString("o")
}
$releaseMetadata | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $extensionStage "release-metadata.json")
Compress-Archive -Path (Join-Path $extensionStage "*") -DestinationPath $extensionZip
Remove-Item -LiteralPath $extensionStage -Recurse -Force
$serverStage = Join-Path $out "_server"
Assert-StagingPath $serverStage
Remove-Item -LiteralPath $serverStage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path (Join-Path $serverStage "apps\server"),(Join-Path $serverStage "packages\core") | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\server\dist") -Destination (Join-Path $serverStage "apps\server")
Copy-Item -Recurse -Force (Join-Path $root "apps\server\assets") -Destination (Join-Path $serverStage "apps\server")
Copy-Item -Force (Join-Path $root "apps\server\package.json"),(Join-Path $root "apps\server\.env.example") -Destination (Join-Path $serverStage "apps\server")
Copy-Item -Recurse -Force (Join-Path $root "packages\core\dist") -Destination (Join-Path $serverStage "packages\core")
Copy-Item -Force (Join-Path $root "packages\core\package.json") -Destination (Join-Path $serverStage "packages\core")
Copy-Item -Force package.json,pnpm-workspace.yaml,pnpm-lock.yaml,start-windows.bat,tunnel-windows.bat,setup-tunnel-key-windows.bat -Destination $serverStage
New-Item -ItemType Directory -Force -Path (Join-Path $serverStage "scripts") | Out-Null
Copy-Item -Force (Join-Path $root "scripts\install-openai-tunnel-client.ps1"),(Join-Path $root "scripts\setup-tunnel-key.ps1"),(Join-Path $root "scripts\start-openai-tunnel.ps1") -Destination (Join-Path $serverStage "scripts")
Compress-Archive -Path (Join-Path $serverStage "*") -DestinationPath $serverZip
New-Item -ItemType Directory -Force -Path (Join-Path $serverStage "docs") | Out-Null
Copy-Item -Force (Join-Path $root "docs\GPT_APP_SETUP_KO.md"),(Join-Path $root "docs\OFFICIAL_DOCS_DECISIONS.md"),(Join-Path $root "PRIVACY.md"),(Join-Path $root "TERMS.md"),(Join-Path $root "SECURITY.md") -Destination (Join-Path $serverStage "docs")
Compress-Archive -Path (Join-Path $serverStage "*") -DestinationPath $chatgptZip
Remove-Item -LiteralPath $serverStage -Recurse -Force
$workerStage = Join-Path $out "_worker"
Assert-StagingPath $workerStage
Remove-Item -LiteralPath $workerStage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path (Join-Path $workerStage "apps\worker"),(Join-Path $workerStage "apps\server\src"),(Join-Path $workerStage "packages\core") | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\worker\src"),(Join-Path $root "apps\worker\scripts") -Destination (Join-Path $workerStage "apps\worker")
Copy-Item -Force (Join-Path $root "apps\worker\package.json"),(Join-Path $root "apps\worker\tsconfig.json"),(Join-Path $root "apps\worker\wrangler.jsonc") -Destination (Join-Path $workerStage "apps\worker")
Copy-Item -Force (Join-Path $root "apps\server\src\mcp.ts"),(Join-Path $root "apps\server\src\widget.ts") -Destination (Join-Path $workerStage "apps\server\src")
Copy-Item -Recurse -Force (Join-Path $root "packages\core\src") -Destination (Join-Path $workerStage "packages\core")
Copy-Item -Force (Join-Path $root "packages\core\package.json"),(Join-Path $root "packages\core\tsconfig.json") -Destination (Join-Path $workerStage "packages\core")
Copy-Item -Force package.json,pnpm-workspace.yaml,pnpm-lock.yaml,eslint.config.js -Destination $workerStage
New-Item -ItemType Directory -Force -Path (Join-Path $workerStage "docs") | Out-Null
Copy-Item -Force (Join-Path $root "docs\DEPLOYMENT_KO.md"),(Join-Path $root "docs\GPT_APP_SETUP_KO.md"),(Join-Path $root "docs\AFFILIATE_COMPLIANCE.md"),(Join-Path $root "PRIVACY.md"),(Join-Path $root "TERMS.md"),(Join-Path $root "SECURITY.md") -Destination (Join-Path $workerStage "docs")
Compress-Archive -Path (Join-Path $workerStage "*") -DestinationPath $workerZip
Remove-Item -LiteralPath $workerStage -Recurse -Force
$stage = Join-Path $out "_full"
Assert-StagingPath $stage
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -Recurse -Force apps,packages,docs,scripts,tests -Destination $stage
Copy-Item -Force package.json,pnpm-workspace.yaml,pnpm-lock.yaml,eslint.config.js,playwright.config.ts,tsconfig.playwright.json,README.md,START_HERE_KO.md,SECURITY.md,PRIVACY.md,TERMS.md,LICENSE,VERSION,RELEASE_NOTES.md,TEST_REPORT.md,sample-list.txt,setup-windows.bat,start-windows.bat,doctor-windows.bat,package-windows.bat,tunnel-windows.bat,setup-tunnel-key-windows.bat,launch-windows.bat,install-extension-windows.bat,resume-public-release-windows.bat -Destination $stage
Get-ChildItem -Path $stage -Recurse -Directory -Filter node_modules | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -Directory -Filter preview-dist | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -Directory -Filter .generated | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -Directory -Filter .wrangler | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -Directory -Filter .wrangler-dist | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -Directory -Filter .data | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -File -Include .env,*.log | Remove-Item -Force
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $fullZip
Remove-Item -LiteralPath $stage -Recurse -Force
Copy-Item -Force (Join-Path $root "RELEASE_NOTES.md") -Destination (Join-Path $out "RELEASE_NOTES.md")
Copy-Item -Force (Join-Path $root "TEST_REPORT.md") -Destination (Join-Path $out "TEST_REPORT.md")
Copy-Item -Force (Join-Path $root "docs\LIVE_TEST_REPORT.md") -Destination (Join-Path $out "LIVE_TEST_REPORT.md")
$hashes = Get-FileHash -Algorithm SHA256 $extensionZip,$serverZip,$workerZip,$chatgptZip,$fullZip
$hashes | ForEach-Object {
  $relativePath = $_.Path.Substring($out.Length).TrimStart([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar).Replace('\','/')
  "$($_.Hash)  $relativePath"
} | Set-Content -Encoding utf8 (Join-Path $out "SHA256SUMS.txt")
Write-Host "DdakDama packages ready: $out"
