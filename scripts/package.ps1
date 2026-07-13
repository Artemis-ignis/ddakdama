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
$version = "1.0.0"
$extensionZip = Join-Path $out "ddakdama-extension-dev-v$version.zip"
$serverZip = Join-Path $out "ddakdama-server-v$version.zip"
$fullZip = Join-Path $out "ddakdama-full-v$version.zip"
Remove-Item -LiteralPath $extensionZip,$serverZip,$fullZip -Force -ErrorAction SilentlyContinue
$extensionStage = Join-Path $out "_extension"
Assert-StagingPath $extensionStage
Remove-Item -LiteralPath $extensionStage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $extensionStage | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\extension\dist") -Destination $extensionStage
Copy-Item -Force (Join-Path $root "apps\extension\manifest.json") -Destination $extensionStage
Compress-Archive -Path (Join-Path $extensionStage "*") -DestinationPath $extensionZip
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
Remove-Item -LiteralPath $serverStage -Recurse -Force
$stage = Join-Path $out "_full"
Assert-StagingPath $stage
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -Recurse -Force apps,packages,docs,scripts -Destination $stage
Copy-Item -Force package.json,pnpm-workspace.yaml,pnpm-lock.yaml,README.md,START_HERE_KO.md,SECURITY.md,PRIVACY.md,TERMS.md,RELEASE_NOTES.md,TEST_REPORT.md,sample-list.txt,setup-windows.bat,start-windows.bat,doctor-windows.bat,package-windows.bat,tunnel-windows.bat,launch-windows.bat,install-extension-windows.bat -Destination $stage
Get-ChildItem -Path $stage -Recurse -Directory -Filter node_modules | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -File -Include .env,*.log | Remove-Item -Force
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $fullZip
Remove-Item -LiteralPath $stage -Recurse -Force
$hashes = Get-FileHash -Algorithm SHA256 $extensionZip,$serverZip,$fullZip
$hashes | ForEach-Object { "$($_.Hash)  $([IO.Path]::GetFileName($_.Path))" } | Set-Content -Encoding utf8 (Join-Path $out "SHA256SUMS.txt")
Write-Host "딱담아 패키징 완료: $out"
