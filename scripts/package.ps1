$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
pnpm build
$out = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$version = "1.0.0"
$extensionZip = Join-Path $out "ddakdama-extension-dev-v$version.zip"
$serverZip = Join-Path $out "ddakdama-server-v$version.zip"
$fullZip = Join-Path $out "ddakdama-full-v$version.zip"
Remove-Item -LiteralPath $extensionZip,$serverZip,$fullZip -Force -ErrorAction SilentlyContinue
$extensionStage = Join-Path $out "_extension"
Remove-Item -LiteralPath $extensionStage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $extensionStage | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\extension\dist") -Destination $extensionStage
Copy-Item -Force (Join-Path $root "apps\extension\manifest.json") -Destination $extensionStage
Compress-Archive -Path (Join-Path $extensionStage "*") -DestinationPath $extensionZip
Remove-Item -LiteralPath $extensionStage -Recurse -Force
Compress-Archive -Path (Join-Path $root "apps\server\dist"),(Join-Path $root "apps\server\package.json"),(Join-Path $root "apps\server\.env.example") -DestinationPath $serverZip
$stage = Join-Path $out "_full"
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -Recurse -Force apps,packages,docs,scripts -Destination $stage
Copy-Item -Force package.json,pnpm-workspace.yaml,pnpm-lock.yaml,START_HERE_KO.md,setup-windows.bat,start-windows.bat,doctor-windows.bat,package-windows.bat -Destination $stage
Get-ChildItem -Path $stage -Recurse -Directory -Filter node_modules | Remove-Item -Recurse -Force
Get-ChildItem -Path $stage -Recurse -File -Include .env,*.log | Remove-Item -Force
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $fullZip
Remove-Item -LiteralPath $stage -Recurse -Force
$hashes = Get-FileHash -Algorithm SHA256 $extensionZip,$serverZip,$fullZip
$hashes | ForEach-Object { "$($_.Hash)  $([IO.Path]::GetFileName($_.Path))" } | Set-Content -Encoding utf8 (Join-Path $out "SHA256SUMS.txt")
Write-Host "딱담아 패키징 완료: $out"
