param(
  [Parameter(Mandatory = $true)][string]$PublicOrigin
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path $root "dist\ddakdama-extension-v1.0.0.zip"

$uri = $null
if (-not [Uri]::TryCreate($PublicOrigin, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne "https" -or $uri.IsLoopback) {
  throw "PublicOrigin must be a non-loopback HTTPS origin."
}
$origin = $uri.GetLeftPart([UriPartial]::Authority).TrimEnd('/')

if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
  throw "Extension package not found: $zipPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($zip.Entries)
  $names = @($entries | ForEach-Object { $_.FullName.Replace('\', '/') })
  foreach ($required in @("manifest.json", "release-metadata.json", "assets/icon-16.png", "assets/icon-48.png", "assets/icon-128.png", "assets/icon-256.png")) {
    if ($required -notin $names) {
      throw "Required package entry is missing: $required"
    }
  }

  $manifestEntry = $entries | Where-Object { $_.FullName.Replace('\', '/') -eq "manifest.json" } | Select-Object -First 1
  $reader = [IO.StreamReader]::new($manifestEntry.Open())
  try { $manifest = ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }

  $expectedPermission = "$origin/*"
  if ($expectedPermission -notin @($manifest.host_permissions)) {
    throw "The manifest does not contain the public service permission: $expectedPermission"
  }
  if (@($manifest.host_permissions) | Where-Object { $_ -match 'localhost|127\.0\.0\.1' }) {
    throw "The public manifest still contains a local host permission."
  }

  $metadataEntry = $entries | Where-Object { $_.FullName.Replace('\', '/') -eq "release-metadata.json" } | Select-Object -First 1
  $reader = [IO.StreamReader]::new($metadataEntry.Open())
  try { $metadata = ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
  if ($metadata.serverOrigin -ne $origin) {
    throw "Release metadata origin does not match the deployed service."
  }
  if ($metadata.affiliateEnabled -ne $false) {
    throw "The public package must keep affiliate linking disabled until policy requirements are met."
  }

  $forbidden = @('http://localhost', 'http://127.0.0.1', 'CONTROL_PLANE_API_KEY', 'COUPANG_PARTNERS_SECRET_KEY', 'COUPANG_PARTNERS_ACCESS_KEY')
  foreach ($entry in $entries | Where-Object { $_.Length -gt 0 -and $_.FullName -match '\.(js|json|html|css|txt)$' }) {
    $reader = [IO.StreamReader]::new($entry.Open())
    try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
    foreach ($needle in $forbidden) {
      if ($content.IndexOf($needle, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw "Forbidden public-package value '$needle' found in $($entry.FullName)."
      }
    }
  }
}
finally {
  $zip.Dispose()
}

Write-Host "Public extension package verification passed." -ForegroundColor Green
