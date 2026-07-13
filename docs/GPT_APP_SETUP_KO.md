# ChatGPT 앱 설정

딱담아 GPT 앱은 일반 Custom GPT가 아니라 OpenAI Apps SDK 기반의 MCP 앱입니다.

## 가장 쉬운 연결 방법

앱 등록을 끝낸 뒤 평소에는 아래 세 단계만 사용합니다.

1. `launch-windows.bat`을 더블클릭합니다.
2. Chrome 딱담아에서 `연결하기`를 누른 뒤 표시된 6자리 숫자를 ChatGPT 딱담아 화면에 입력합니다.
3. ChatGPT에서 `확장 프로그램으로 보내기`를 누르고, Chrome 딱담아에서 `목록 받기`를 누릅니다.

서버 주소, 토큰, 내부 전송 ID는 일반 화면에 나오지 않으며 직접 입력할 필요도 없습니다. 코드는 10분 동안 한 번만 유효합니다. 연결이 만료되면 `연결하기`로 새 코드를 만들면 됩니다.

## 먼저 확인할 계정 조건

2026-07-13 기준 OpenAI 공식 안내상 사용자 정의 MCP 앱의 개발자 모드는 ChatGPT Business, Enterprise 또는 Edu 워크스페이스에서 제공됩니다.

- Business: 워크스페이스 관리자 또는 소유자만 개발자 모드를 켜고 앱을 만들 수 있습니다.
- Enterprise/Edu: 관리자가 권한을 부여한 사용자와 관리자/소유자가 사용할 수 있습니다.
- Pro 개인 계정: 현재 사용자 정의 MCP 앱을 등록하는 Developer mode/Create 메뉴가 제공되지 않습니다.

현재 계정에서 `설정 → 플러그인` 또는 앱 화면에 `고급 설정`, `Developer mode`, `Create`가 없다면 서버나 브라우저 오류가 아닙니다. Business/Enterprise/Edu 워크스페이스 자격과 관리자 권한을 먼저 준비해야 합니다.

공식 안내:

- https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta
- https://developers.openai.com/apps-sdk/deploy/connect-chatgpt

## 로컬 서버 준비

1. `start-windows.bat`를 실행합니다.
2. `http://localhost:8787/health`에서 `ok: true`를 확인합니다.
3. 개발 중에는 `tunnel-windows.bat`를 실행해 8787 포트를 공개 HTTPS 주소로 연결합니다.
4. Quick Tunnel 주소는 재시작할 때 바뀔 수 있으므로 새 주소를 사용할 때 앱의 MCP URL도 갱신합니다.

## 지원되는 워크스페이스에서 등록

### Business

1. Business 워크스페이스의 관리자 또는 소유자 계정으로 전환합니다.
2. `Workspace settings → Apps → Create`로 이동합니다.
3. 개발자 모드 안내와 위험 고지를 확인하고 활성화합니다.
4. 앱 이름을 `딱담아`로 입력합니다.
5. MCP URL에 `https://공개주소/mcp`를 입력합니다.
6. 도구 목록과 위젯이 정상적으로 읽히는지 확인한 뒤 비공개 테스트 앱으로 생성합니다.

### Enterprise/Edu

1. 관리자가 `Workspace settings → Permissions & Roles → Connected Data`에서 Developer mode 권한을 허용합니다.
2. 권한을 받은 사용자는 `Settings → Apps → Advanced settings`에서 Developer mode를 켭니다.
3. 관리자/소유자는 `Workspace settings → Apps → Create`에서도 앱을 만들 수 있습니다.
4. MCP URL에 `https://공개주소/mcp`를 입력합니다.

메뉴 명칭은 베타 UI 변경에 따라 조금 달라질 수 있습니다. 핵심은 개인 Pro 설정이 아니라 지원되는 워크스페이스의 Apps 관리 화면에서 등록하는 것입니다.

## 딱담아 테스트 순서

1. ChatGPT에서 딱담아 앱을 선택합니다.
2. 고정 쇼핑 목록을 입력합니다.
3. 위젯에서 요청 5종, 실물 7개가 표시되는지 확인합니다.
4. 딱담아 Chrome 확장 프로그램에서 페어링 코드를 발급합니다.
5. GPT 앱 위젯에 코드를 입력해 연결합니다.
6. `딱담아로 보내기`를 눌러 계획을 전송합니다.
7. 확장 프로그램에서 계획을 수신하고 쿠팡 후보·가격·수량을 검토합니다.
8. 실제 장바구니 변경은 확장 프로그램에서 사용자가 최종 승인합니다.

딱담아 위젯은 현재 MCP Apps 표준 브리지로 도구를 호출하고, 호환 환경에서만 ChatGPT 전용 브리지를 보조 경로로 사용합니다. 목록 분석과 전송은 같은 수량 스키마를 사용하므로 `100mg 240정`을 구매수량 240개로 바꾸지 않습니다.

## 현재 Pro 계정에서 가능한 범위

- MCP 서버 로컬 실행과 원격 HTTPS 상태 확인
- MCP 클라이언트 스모크 테스트
- ChatGPT 위젯 번들 및 도구 스키마 자동 테스트
- Chrome 확장 프로그램과 페어링/handoff API 검증

Pro 계정만으로는 ChatGPT 내부에 사용자 정의 딱담아 앱을 등록해 실행하는 마지막 단계까지 진행할 수 없습니다. 이 제한을 우회하는 비공식 방식은 사용하지 않습니다.
