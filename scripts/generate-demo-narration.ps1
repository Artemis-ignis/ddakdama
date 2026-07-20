param(
  [Parameter(Mandatory = $true)][string]$OutputWavePath,
  [Parameter(Mandatory = $true)][string]$SubtitlePath
)

Add-Type -AssemblyName System.Speech

$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$preferred = 'Microsoft Zira Desktop'
if (($voice.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }) -contains $preferred) {
  $voice.SelectVoice($preferred)
}
$voice.Rate = 1
$voice.Volume = 100

$narration = @'
Welcome to DdakDama. It turns a natural-language shopping list into a clear, reviewable cart plan.

GPT-5.6 helps interpret product names, sizes, package contents, and requested physical quantities. For example, 100 milligrams is a strength, while 240 tablets is one package, not 240 purchases.

After review, the plan moves from the ChatGPT app to the paired Chrome extension. The extension searches Coupang and keeps every real candidate available for review.

Only an exact product, size, and package match is selected automatically. Similar results stay visible as a review choice, so the user can compare, remove, or search again.

Before a cart change, DdakDama checks identity, price, stock, options, and the required quantity. A click is not a success: it verifies the cart quantity change afterward.

Codex accelerated the parser, extension workflow, MCP handoff, and regression tests. Checkout and order confirmation always remain with the user.
'@

$subtitle = @'
1
00:00:01,000 --> 00:00:06,000
Welcome to DdakDama. It turns a natural-language shopping list into a clear, reviewable cart plan.

2
00:00:06,000 --> 00:00:14,000
GPT-5.6 interprets product names, sizes, package contents, and requested physical quantities.

3
00:00:14,000 --> 00:00:21,000
100 milligrams is a strength; 240 tablets is one package, not 240 purchases.

4
00:00:21,000 --> 00:00:29,000
After review, the plan moves from the ChatGPT app to the paired Chrome extension.

5
00:00:29,000 --> 00:00:37,000
Every real result stays available. Only an exact product, size, and package match is selected automatically.

6
00:00:37,000 --> 00:00:45,000
Similar results remain review choices, so the user can compare, remove, or search again.

7
00:00:45,000 --> 00:00:52,000
DdakDama checks identity, price, stock, options, and quantity. Checkout always remains with the user.
'@

$directory = Split-Path -Parent $OutputWavePath
New-Item -ItemType Directory -Force $directory | Out-Null
Set-Content -Path $SubtitlePath -Value $subtitle -Encoding utf8
$voice.SetOutputToWaveFile($OutputWavePath)
$voice.Speak($narration)
$voice.Dispose()
