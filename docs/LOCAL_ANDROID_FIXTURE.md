# Android fixture 수직 검증

실제 쿠팡 API, 로그인, 주문 없이 Android 실행 계약을 검증할 때만 사용합니다.

1. Worker를 fixture 카탈로그로 시작합니다.

```powershell
pnpm --filter @ddakdama/worker exec wrangler dev --port 8792 --var FIXTURE_CATALOG_ENABLED:true
```

별도 터미널에서 Worker 계약 전체를 검증합니다.

```powershell
pnpm --filter @ddakdama/worker test:fixture-flow http://127.0.0.1:8792
```

2. Android Emulator에서는 `10.0.2.2`를 사용해 debug APK를 빌드합니다.

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Push-Location apps/mobile-android
.\gradlew.bat `
  -PddakdamaApiOrigin=http://10.0.2.2:8792 `
  :app:assembleDebug
Pop-Location
```

`apps/mobile-android/gradlew`와 `gradlew.bat`는 저장소에 포함되어 있으므로, 별도 Gradle 설치는 필요하지 않습니다. 실제 에뮬레이터 검증은 APK를 설치한 뒤 `ddakdama://execute/<execution-id>?claim=<claim-token>` App Link를 열어 진행합니다.

debug manifest만 cleartext local fixture origin을 허용합니다. release build는 `https://ddakdama.artemis-clunk.workers.dev`를 기본값으로 하고 cleartext를 허용하지 않습니다. `FIXTURE_CATALOG_ENABLED`는 production config에서 항상 `false`입니다.
