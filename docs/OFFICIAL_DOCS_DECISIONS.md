# 공식 문서 기준 결정

확인일: 2026-07-15

## OpenAI Apps SDK

- 앱 유형은 interactive-decoupled로 분류합니다.
- MCP 서버는 필수이고 UI는 검색·수량·가격·진행 상태를 사용자 친화적으로 보여주는 위젯으로 구성합니다.
- 도구에는 read-only 여부, 외부 상태 변경 여부와 idempotency를 명시합니다.
- 대화에 필요한 값은 `structuredContent`, 위젯 전용 비공개 값은 `_meta`로 분리합니다.
- 위젯의 도구 호출은 MCP Apps JSON-RPC 브리지(`ui/initialize`, `ui/notifications/initialized`, `tools/call`)를 우선하고 `window.openai`는 호환 보조 경로로만 둡니다.
- 연결은 일반 사용자가 서버 주소나 토큰을 입력하지 않는 일회용 6자리 코드 방식으로 구성합니다.
- 일반 사용자용 ChatGPT 앱은 안정적인 공개 HTTPS `/mcp`를 사용합니다. 같은 MCP 주소를 모든 사용자에게 제공하고 사용자 데이터는 6자리 일회용 페어링 코드와 device grant로 분리합니다.
- 공개 MCP는 Cloudflare Worker와 Durable Object로 운영하며 개인정보 처리방침·이용약관·지원 페이지도 같은 안정적 origin에서 제공합니다.
- OpenAI Secure MCP Tunnel과 로컬 MCP 서버는 배포 전 개발 검증에만 사용합니다. 터널 API 키와 로컬 서버 실행을 일반 사용자에게 요구하지 않습니다.
- 2026-07-13 공식 개발자 모드 안내 기준 Pro, Plus, Business, Enterprise, Education 계정은 웹에서 원격 MCP 앱을 연결할 수 있으며 개발자 모드에서 읽기·쓰기 도구를 모두 사용할 수 있습니다.
- 개인 계정은 `Settings → Security and login → Developer mode`를 켠 뒤 `Settings → Plugins`에서 앱을 만듭니다.
- 조직용 워크스페이스에서는 관리자가 개발자 모드와 허용 도구 정책을 제한할 수 있습니다.
- 공개 베타는 자체 로그인 계정을 요구하지 않으므로 ChatGPT 플러그인 연결 자체는 `인증 없음`을 사용합니다. 확장 프로그램 연결은 앱 내부의 6자리 페어링으로 별도 보호합니다.
- 제출 전에는 조직 인증, Apps SDK 앱 생성·수정 권한, 운영 MCP URL, 개인정보 처리방침·지원 URL과 테스트 프롬프트를 준비합니다. 게시 후 MCP origin 변경은 새 앱 제출이 필요할 수 있으므로 임시 터널 URL을 운영 주소로 사용하지 않습니다.
- 위젯 URI는 ChatGPT의 캐시 키이므로 HTML·JS·CSS 변경 시 새 버전 URI를 사용하고 도구의 `_meta.ui.resourceUri`, 호환용 `openai/outputTemplate`, 등록 리소스의 `contents[].uri`를 함께 갱신합니다. 이미 배포된 URI를 참조하는 기존 대화가 실패하지 않도록 직전 URI는 동일한 최신 위젯을 반환하는 읽기 전용 호환 리소스로 유지합니다.

참고:

- https://developers.openai.com/apps-sdk/quickstart
- https://developers.openai.com/apps-sdk/build/mcp-server
- https://developers.openai.com/apps-sdk/build/chatgpt-ui
- https://developers.openai.com/apps-sdk/reference
- https://developers.openai.com/apps-sdk/deploy/troubleshooting
- https://developers.openai.com/apps-sdk/deploy
- https://developers.openai.com/apps-sdk/deploy/submission
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels

## Chrome Web Store

- 제휴 프로그램은 설치 전 스토어 설명과 사용자 UI에서 명확히 고지해야 합니다.
- 관련 사용자 동작과 직접적이고 투명한 사용자 혜택 없이 제휴 링크나 쿠키를 삽입하면 안 됩니다.
- private 개발 빌드는 명시적 사용자 동작 뒤에만 적용하도록 하고, 공개 단일 패키지는 실제 혜택과 플랫폼 허용이 구현·검증되기 전까지 `VITE_DDAKDAMA_AFFILIATE_ENABLED=false`로 제휴 검색·딥링크·고지를 모두 차단합니다.

참고: https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads/

## Chrome 확장 프로그램 자동 검증

- Chrome 공식 E2E 지침: https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing
- Playwright 공식 Chrome Extensions 지침: https://playwright.dev/docs/chrome-extensions
- Google Chrome과 Edge는 확장 사이드로드용 명령줄 플래그를 제거했으므로 Playwright 번들 Chromium persistent context를 사용합니다.
- 확장 경로는 `manifest.json`이 존재하는 단일 `apps/extension` 루트이며 `dist`만 로드하지 않습니다.
- MV3 서비스 워커 URL에서 동적 extension ID를 찾고 `chrome-extension://<id>/dist/index.html`을 실제 탐색합니다.
- Side Panel 기본 경로는 매니페스트 내부 상대경로를 사용합니다: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

## 쿠팡 파트너스

공개 검색만으로 판매자 WING API와 파트너스 API를 혼동하지 않습니다. 로그인 후 제공되는 쿠팡 파트너스 공식 문서에서 계정 권한, 현재 인증 방식, Product Search 및 Deep Link 규격을 확인한 뒤 실제 키로 검증합니다. 승인되지 않은 계정에서는 실제 API 성공을 주장하지 않고 일반 쿠팡 브라우저 검색 fallback을 사용합니다.
