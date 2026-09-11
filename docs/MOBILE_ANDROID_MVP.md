# Android MVP

## 최초 진입

Android 앱은 ChatGPT 연결을 선행 조건으로 요구하지 않는다. 시작 화면에는 직접 쇼핑 목록 입력과 `GPT 사용 방법 보기`를 함께 제공한다. 사용자가 ChatGPT 설정을 완료하지 못해도 같은 화면의 목록 입력으로 즉시 돌아와 상품 검색을 시작할 수 있다.

파트너스 API가 미설정인 개발·초기 운영 환경에서는 각 목록 항목마다 일반 쿠팡 검색을 여는 fallback을 제공한다. 이 링크는 제휴 링크가 아니며, 자동 장바구니·수익 추적 기능으로 표시하지 않는다.

Android 프로젝트는 `apps/mobile-android`에 있다. Kotlin/Compose와 안전 제한 WebView를 사용하며, 기본 흐름은 App Link 수신 → execution claim → 계획 검토 → fixture 장바구니 실행 → 상태 보고다.

- 허용 WebView 호스트: `www.coupang.com`, `m.coupang.com`, `cart.coupang.com`, `link.coupang.com`
- `file://`, `content://`, 혼합 콘텐츠와 임의 custom scheme은 차단한다.
- 쿠팡 로그인 정보와 쿠키는 앱 WebView에만 남기며 Worker에 보내지 않는다.
- `addJavascriptInterface`는 사용하지 않고 `evaluateJavascript`의 작은 JSON 결과만 받는다.
- `REAL_COUPANG_AUTOMATION_ENABLED`는 모든 빌드 타입에서 기본 `false`다.

현재 구현은 bundled fixture만 실행한다. Android SDK와 Gradle wrapper를 설치한 환경에서 emulator QA 후 실제 Coupang adapter를 기능 플래그 뒤에 추가해야 한다.
