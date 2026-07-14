# ChatGPT 앱 설정

딱담아 GPT 앱은 일반 Custom GPT가 아니라 OpenAI Apps SDK 기반의 MCP 앱입니다.

## 가장 쉬운 연결 방법

앱 등록을 끝낸 뒤 평소에는 아래 세 단계만 사용합니다.

1. `launch-windows.bat`을 더블클릭합니다.
2. Chrome 딱담아에서 `연결하기`를 누른 뒤 표시된 6자리 숫자를 ChatGPT 딱담아 화면에 입력합니다.
3. ChatGPT에서 `확장 프로그램으로 보내기`를 누르고, Chrome 딱담아에서 `목록 받기`를 누릅니다.

서버 주소, 토큰, 내부 전송 ID는 일반 화면에 나오지 않으며 직접 입력할 필요도 없습니다. 코드는 10분 동안 한 번만 유효합니다. 연결이 만료되면 `연결하기`로 새 코드를 만들면 됩니다.

## 처음 한 번: 터널 전용 API 키

1. OpenAI Platform의 `딱담아` 프로젝트에서 새 Secret key를 만듭니다.
2. 이름은 `ddakdama-tunnel-client`, 소유자는 `You`, 권한은 `Restricted`를 선택합니다.
3. 다른 권한은 `None`으로 두고 `Tunnels`의 `Read`와 `Use`만 선택합니다.
4. 키가 한 번 표시되면 `setup-tunnel-key-windows.bat`을 실행해 보이지 않는 입력창에 붙여 넣습니다.
5. 키를 ChatGPT 대화, 소스 코드, `.env`, 스크린샷에 넣지 않습니다.

설정 스크립트는 키를 `%LOCALAPPDATA%\DdakDama\secrets\tunnel-control-plane-key.dpapi`에 Windows DPAPI로 암호화해 저장합니다. 같은 Windows 계정과 같은 컴퓨터에서만 복호화됩니다. API 키 생성 자체에는 비용이 없고, 이 터널 키는 모델 호출이 아니라 터널 제어 연결에 사용됩니다.

## 먼저 확인할 계정 조건

2026-07-13 기준 OpenAI 공식 개발자 모드 안내에서는 ChatGPT Pro, Plus, Business, Enterprise, Education 계정이 웹에서 원격 MCP 앱을 연결할 수 있습니다. 개발자 모드에서는 읽기와 쓰기 도구를 모두 사용할 수 있지만, 조직용 워크스페이스는 관리자의 앱·도구 정책에 따라 제한될 수 있습니다.

- Pro/Plus 개인 계정: `Settings → Security and login → Developer mode`를 켠 뒤 `Settings → Plugins`에서 개인용 앱을 만들 수 있습니다.
- Business/Enterprise/Education: 워크스페이스 관리자가 개발자 모드와 허용 도구 정책을 제한할 수 있습니다.

메뉴가 보이지 않으면 ChatGPT 웹을 사용 중인지, 지원 요금제인지, 조직 정책으로 개발자 모드가 차단되지 않았는지 확인합니다.

공식 안내:

- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://developers.openai.com/apps-sdk/quickstart
- https://developers.openai.com/apps-sdk/build/mcp-server
- https://developers.openai.com/apps-sdk/build/chatgpt-ui

## 로컬 서버와 OpenAI Secure MCP Tunnel 준비

1. `start-windows.bat`를 실행합니다.
2. `http://localhost:8787/health`에서 `ok: true`를 확인합니다.
3. `tunnel-windows.bat`를 실행합니다.
4. 터널 클라이언트가 `doctor` 검사를 통과한 뒤 실행 상태를 유지합니다.

Secure MCP Tunnel은 로컬 MCP 서버를 인터넷에 공개하지 않습니다. `tunnel-client`가 OpenAI로 아웃바운드 HTTPS 연결을 만들고 요청을 `http://127.0.0.1:8787/mcp`로 전달합니다. 실행 중 브라우저 탭을 자동으로 열지 않습니다.

## ChatGPT에 등록

1. `Settings → Security and login → Developer mode`를 켭니다.
2. `Settings → Plugins` 또는 `https://chatgpt.com/plugins`로 이동합니다.
3. `앱 만들기`를 누릅니다.
4. 이름은 `딱담아`, 연결은 `Tunnel`을 선택합니다.
5. 목록에서 `딱담아 로컬 MCP`를 선택합니다. 목록에 없으면 터널 ID `tunnel_6a558b1cfec48191993a91062fa9f5e3`을 입력합니다.
6. 선택 아이콘은 `apps/extension/assets/icon-256.png`를 사용합니다.
7. 사용자 지정 MCP 서버 위험 고지를 확인하고 체크한 뒤 `만들기` 또는 `업데이트`를 누릅니다.
8. 새 채팅의 앱 메뉴에서 `딱담아`를 선택해 도구와 위젯을 테스트합니다.

터널이 목록에 없으면 `tunnel-windows.bat` 창이 실행 중인지, Platform 터널이 현재 ChatGPT 개인 워크스페이스와 연결됐는지, API 키에 Tunnels `Read + Use`가 있는지 확인합니다.

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

## 개인 Pro 계정에서 가능한 범위

- 딱담아 MCP 앱 등록과 위젯 실행
- `parse_shopping_list`, `create_cart_plan` 같은 읽기 도구 호출
- `pair_extension_device`, `send_cart_plan`, `disconnect_extension_device` 같은 쓰기 도구 호출
- Chrome 확장 프로그램과 페어링 및 장바구니 계획 전달

쓰기 도구는 ChatGPT가 실행 전에 확인을 요청할 수 있습니다. 실제 쿠팡 장바구니 변경은 계속 Chrome 확장 프로그램에서 사용자가 최종 승인하며, GPT 앱은 결제나 주문을 실행하지 않습니다.
