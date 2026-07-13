$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
function Assert-StagingPath([string]$Path) {
  $rootFull = [IO.Path]::GetFullPath($root).TrimEnd([IO.Path]::DirectorySeparatorChar)
  $pathFull = [IO.Path]::GetFullPath($Path)
  if (-not $pathFull.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "패키징 경로가 작업 폴더 밖입니다: $pathFull"
  }
}
pnpm build
$out = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$internalOut = Join-Path $out "internal"
Assert-StagingPath $internalOut
New-Item -ItemType Directory -Force -Path $internalOut | Out-Null
$version = "1.0.0"
$extensionZip = Join-Path $out "ddakdama-extension-v$version.zip"
$webstoreExtensionZip = Join-Path $internalOut "ddakdama-extension-webstore-v$version.zip"
$serverZip = Join-Path $out "ddakdama-server-v$version.zip"
$chatgptZip = Join-Path $out "ddakdama-chatgpt-app-v$version.zip"
$fullZip = Join-Path $out "ddakdama-full-v$version.zip"
Get-ChildItem -LiteralPath $out -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "ddakdama-extension-dev-v*.zip" -or $_.Name -like "ddakdama-extension-webstore-v*.zip" } | Remove-Item -Force
Remove-Item -LiteralPath $extensionZip,$webstoreExtensionZip,$serverZip,$chatgptZip,$fullZip -Force -ErrorAction SilentlyContinue
$extensionStage = Join-Path $out "_extension"
Assert-StagingPath $extensionStage
Remove-Item -LiteralPath $extensionStage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $extensionStage | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\extension\dist") -Destination $extensionStage
Copy-Item -Force (Join-Path $root "apps\extension\manifest.json") -Destination $extensionStage
Compress-Archive -Path (Join-Path $extensionStage "*") -DestinationPath $extensionZip
$webstoreManifest = Get-Content (Join-Path $extensionStage "manifest.json") -Raw -Encoding utf8 | ConvertFrom-Json
$webstoreManifest.host_permissions = @($webstoreManifest.host_permissions | Where-Object { $_ -notmatch '^http://localhost:' })
$productionServerOrigin = $env:VITE_DDAKDAMA_SERVER_ORIGIN
if ($productionServerOrigin) {
  $parsedServerOrigin = $null
  if (-not [Uri]::TryCreate($productionServerOrigin, [UriKind]::Absolute, [ref]$parsedServerOrigin) -or $parsedServerOrigin.Scheme -ne "https") {
    throw "VITE_DDAKDAMA_SERVER_ORIGIN은 HTTPS 원본 주소여야 합니다: $productionServerOrigin"
  }
  $serverPermission = $parsedServerOrigin.GetLeftPart([UriPartial]::Authority).TrimEnd('/') + "/*"
  $webstoreManifest.host_permissions = @($webstoreManifest.host_permissions + $serverPermission | Select-Object -Unique)
} else {
  Write-Warning "No production server origin was provided. Set VITE_DDAKDAMA_SERVER_ORIGIN=https://... before packaging a GPT-enabled Web Store build."
}
$webstoreManifest | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 (Join-Path $extensionStage "manifest.json")
Compress-Archive -Path (Join-Path $extensionStage "*") -DestinationPath $webstoreExtensionZip
Remove-Item -LiteralPath $extensionStage -Recurse -Force
$serverStage = Join-Path $out "_server"
Assert-StagingPath $serverStage
Remove-Item -LiteralPath $serverStage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path (Join-Path $serverStage "apps\server"),(Join-Path $serverStage "packages\core") | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\server\dist") -Destination (Join-Path $serverStage "apps\server")
Copy-Item -Force (Join-Path $root "apps\server\package.json"),(Join-Path $root "apps\server\.env.example") -Destination (Join-Path $serverStage "apps\server")
Copy-Item -Recurse -Force (Join-Path $root "packages\core\dist") -Destination (Join-Path $serverStage "packages\core")
Copy-Item -Force (Join-Path $root "packages\core\package.json") -Destination (Join-Path $serverStage "packages\core")
Copy-Item -Force package.json,pnpm-workspace.yaml,pnpm-lock.yaml,start-windows.bat -Destination $serverStage
Compress-Archive -Path (Join-Path $serverStage "*") -DestinationPath $serverZip
New-Item -ItemType Directory -Force -Path (Join-Path $serverStage "docs") | Out-Null
Copy-Item -Force (Join-Path $root "docs\GPT_APP_SETUP_KO.md"),(Join-Path $root "docs\OFFICIAL_DOCS_DECISIONS.md"),(Join-Path $root "PRIVACY.md"),(Join-Path $root "TERMS.md"),(Join-Path $root "SECURITY.md") -Destination (Join-Path $serverStage "docs")
Compress-Archive -Path (Join-Path $serverStage "*") -DestinationPath $chatgptZip
Remove-Item -LiteralPath $serverStage -Recurse -Force
$stage = Join-Path $out "_full"
Assert-StagingPath $stage
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -Recurse -Force apps,packages,docs,scripts,tests -Destination $stage
Copy-Item -Force package.json,pnpm-workspace.yaml,pnpm-lock.yaml,eslint.config.js,playwright.config.ts,tsconfig.playwright.json,README.md,START_HERE_KO.md,SECURITY.md,PRIVACY.md,TERMS.md,LICENSE,VERSION,RELEASE_NOTES.md,TEST_REPORT.md,sample-list.txt,setup-windows.bat,start-windows.bat,doctor-windows.bat,package-windows.bat,tunnel-windows.bat,launch-windows.bat,install-extension-windows.bat -Destination $stage
Get-ChildItem -Path $stage -Recurse -Directory -Filter node_modules | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -Directory -Filter preview-dist | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -Directory -Filter .data | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -File -Include .env,*.log | Remove-Item -Force
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $fullZip
Remove-Item -LiteralPath $stage -Recurse -Force
Copy-Item -Force (Join-Path $root "RELEASE_NOTES.md") -Destination (Join-Path $out "RELEASE_NOTES.md")
Copy-Item -Force (Join-Path $root "TEST_REPORT.md") -Destination (Join-Path $out "TEST_REPORT.md")
Copy-Item -Force (Join-Path $root "docs\LIVE_TEST_REPORT.md") -Destination (Join-Path $out "LIVE_TEST_REPORT.md")
$hashes = Get-FileHash -Algorithm SHA256 $extensionZip,$serverZip,$chatgptZip,$fullZip,$webstoreExtensionZip
$hashes | ForEach-Object {
  $relativePath = $_.Path.Substring($out.Length).TrimStart([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar).Replace('\','/')
  "$($_.Hash)  $relativePath"
} | Set-Content -Encoding utf8 (Join-Path $out "SHA256SUMS.txt")
Write-Host "DdakDama packages ready: $out"
