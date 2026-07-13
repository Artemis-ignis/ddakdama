# 공식 문서 기준 결정

확인일: 2026-07-13

## OpenAI Apps SDK

- 앱 유형은 interactive-decoupled로 분류합니다.
- MCP 서버는 필수이고 UI는 검색·수량·가격·진행 상태를 사용자 친화적으로 보여주는 위젯으로 구성합니다.
- 도구에는 read-only 여부, 외부 상태 변경 여부와 idempotency를 명시합니다.
- 대화에 필요한 값은 `structuredContent`, 위젯 전용 비공개 값은 `_meta`로 분리합니다.
- ChatGPT 연결에는 원격 HTTPS `/mcp` 주소가 필요합니다.
- 2026-07-13 최신 공식 도움말과 실제 화면을 다시 확인한 결과, 사용자 정의 MCP 앱 Developer mode는 Business 및 Enterprise/Edu 워크스페이스 대상입니다.
- Business는 관리자/소유자가 `Workspace settings → Apps → Create`에서 활성화하고 앱을 만듭니다.
- Enterprise/Edu는 관리자가 Connected Data 권한을 부여하고, 허용된 사용자가 `Settings → Apps → Advanced settings`에서 켤 수 있습니다.
- 개인 Pro 계정에는 현재 이 메뉴가 없으므로, Pro 화면의 `보안 및 로그인`에서 개발자 모드를 찾는 기존 안내를 폐기했습니다.

참고:

- https://developers.openai.com/apps-sdk/quickstart
- https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta

## Chrome Web Store

- 제휴 프로그램은 설치 전 스토어 설명과 사용자 UI에서 명확히 고지해야 합니다.
- 관련 사용자 동작과 직접적이고 투명한 사용자 혜택 없이 제휴 링크나 쿠키를 삽입하면 안 됩니다.
- private 빌드는 명시적 사용자 동작 뒤에만 적용하도록 하고, webstore 빌드는 실제 혜택이 구현되기 전까지 제휴 삽입을 차단합니다.

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
