# 딱담아 시작하기

## 처음 한 번만

1. `setup-windows.bat`을 더블클릭합니다.
2. Chrome `chrome://extensions`에서 개발자 모드를 켜고 `apps/extension` 폴더 하나만 불러옵니다.
3. OpenAI Platform의 `딱담아` 프로젝트에서 `ddakdama-tunnel-client` 키를 만들고 터널 `Read + Use` 권한만 줍니다.
4. `setup-tunnel-key-windows.bat`을 실행하고 키를 붙여 넣습니다. 키는 현재 Windows 계정 전용 DPAPI로 암호화되며 프로젝트나 Git에 저장되지 않습니다.
5. ChatGPT 앱 설정에서 연결 방식으로 `Tunnel`을 선택하고 `딱담아 로컬 MCP`를 연결합니다. 자세한 과정은 `docs/GPT_APP_SETUP_KO.md`에 있습니다.

## 평소 사용

1. `launch-windows.bat`을 더블클릭해 서버와 OpenAI Secure MCP Tunnel을 함께 켭니다. 브라우저 탭은 자동으로 열리지 않습니다.
2. 확장 프로그램에서 `연결하기`를 누르고 표시된 6자리 숫자를 ChatGPT 딱담아 앱에 입력합니다.
3. ChatGPT에서 목록을 보낸 뒤 확장 프로그램의 `목록 받기`를 누릅니다.

확장 프로그램만 사용할 때는 GPT 앱 연결 없이 목록을 직접 붙여 넣으면 됩니다. 자동 결제나 주문 확정은 구현되어 있지 않습니다. 자세한 문제 해결은 `docs/TROUBLESHOOTING_KO.md`를 참고합니다.
