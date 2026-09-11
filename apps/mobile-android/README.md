# 딱담아 Android MVP

`fixture-coupang.html`을 이용해 App Link 수신과 다중 상품 실행기 기반을 검증하는 Android 네이티브 MVP입니다. 실제 쿠팡 WebView 자동화는 `REAL_COUPANG_AUTOMATION_ENABLED=false`로 기본 비활성화되어 있으며, 쿠팡 정책·제휴 실적·실기기 검증 전에는 켜면 안 됩니다.

Android SDK를 연결한 뒤 저장소에 포함된 Gradle wrapper로 `./gradlew :app:assembleDebug`를 빌드합니다. `local.properties`에는 각 개발 환경의 Android SDK 경로만 지정합니다. 테스트용 딥링크는 `ddakdama://execute/<execution-id>?claim=<token>` 형식입니다.
