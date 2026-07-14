$ErrorActionPreference = "Stop"

$secretDir = Join-Path $env:LOCALAPPDATA "DdakDama\secrets"
$secretPath = Join-Path $secretDir "tunnel-control-plane-key.dpapi"

New-Item -ItemType Directory -Force -Path $secretDir | Out-Null

Write-Host ""
Write-Host "Paste the ddakdama-tunnel-client key created in OpenAI Platform."
Write-Host "The input stays hidden and is encrypted with Windows DPAPI for this user account."
$secureKey = Read-Host "API key" -AsSecureString

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($plainKey) -or -not $plainKey.StartsWith("sk-")) {
    throw "The value does not look like an OpenAI API key."
  }
  if ($plainKey.Length -lt 40) {
    throw "The API key is unexpectedly short."
  }
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  $plainKey = $null
}

$encrypted = ConvertFrom-SecureString -SecureString $secureKey
[IO.File]::WriteAllText($secretPath, $encrypted, [Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "The tunnel-only API key was stored securely."
Write-Host "Encrypted file: $secretPath"
Write-Host "It can only be decrypted by this Windows account on this computer."
