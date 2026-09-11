Add-Type -AssemblyName System.Speech

$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice('Microsoft Zira Desktop')
$voice.Rate = -1
$voice.Volume = 100
$null = New-Item -ItemType Directory -Force 'C:\ddakdama-voiceover'

$script = @'
Welcome to DdakDama, a shopping assistant that turns a natural-language list into a clear and verifiable cart plan.

Here, the user starts with a simple request. DdakDama separates each item into its product name, size, strength, package contents, and requested quantity.

That distinction matters. For example, one hundred milligrams describes a strength, while two hundred and forty tablets describes the package. They are not purchase quantities.

The ChatGPT app gives the user a readable plan first. After review, the plan can be sent to the paired Chrome extension, where the real shopping workflow happens.

The extension searches Coupang and presents product candidates with their listed price, delivery information, package configuration, and quantity plan.

It does not silently substitute similar products. The user can select a candidate, change the quantity, remove an item, or search again before anything is added.

Before changing the cart, DdakDama performs a preflight check. It confirms the product identity, requested size, package count, live detail-page price, stock status, and any required options.

Only after the user approves does it add the chosen products. After every add, the extension checks the actual cart change by stable product identity and verifies the intended quantity delta.

If an item cannot be verified, it is kept visible as a partial failure instead of being reported as a false success. Payment and order confirmation always remain with the user on Coupang.

Codex helped us build the typed quantity parser, the cart-verification state machine, the MCP handoff flow, the Worker service, the UI, and the regression tests.

GPT-5.6 helps understand the user's shopping intent and calls structured tools to create an editable, transparent plan.

DdakDama closes the gap between an AI recommendation and a trustworthy cart: useful, reviewable, and safe.
'@

$voice.SetOutputToWaveFile('C:\ddakdama-voiceover\ddakdama-build-week-voiceover.wav')
$voice.Speak($script)
$voice.Dispose()
