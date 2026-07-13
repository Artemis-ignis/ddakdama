# ChatGPT 앱 설정

딱담아 GPT 앱은 일반 Custom GPT가 아니라 MCP 서버와 ChatGPT 내부 위젯으로 구성됩니다.

1. start-windows.bat을 실행합니다.
2. http://localhost:8787/health에서 ok: true를 확인합니다.
3. 개발 중에는 `tunnel-windows.bat`을 실행해 8787 포트를 공개 HTTPS 주소로 연결합니다.
4. ChatGPT의 **Settings → Apps & Connectors → Advanced settings**에서 Developer mode를 켭니다. 계정·워크스페이스에 따라 메뉴 이름이나 제공 여부가 다를 수 있습니다.
5. 앱 관리 화면에서 개발자 앱을 만들고 `https://공개주소/mcp`를 등록합니다.
6. 도구나 위젯 metadata를 바꾼 뒤에는 앱 상세 화면에서 새로고침합니다.
7. ChatGPT에서 딱담아를 선택하고 쇼핑 목록을 입력합니다.
8. 위젯에서 규격과 수량을 확인한 뒤 확장 프로그램으로 보냅니다.
9. 실제 쿠팡 상품 검색과 장바구니 변경은 Chrome 확장 프로그램에서 승인합니다.

Developer mode나 앱 추가 메뉴가 없다면 조직 관리자 정책 또는 계정 제공 범위를 확인해야 합니다. Quick Tunnel 주소가 바뀌면 등록한 MCP URL도 갱신해야 합니다.
