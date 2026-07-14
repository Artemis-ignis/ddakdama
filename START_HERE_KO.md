# 딱담아 시작하기

딱담아는 실제 사용자가 로컬 서버나 API 키를 설정하지 않고 사용하는 서비스입니다.

## 일반 사용자

1. Chrome Web Store에서 딱담아 확장 프로그램을 설치합니다.
2. ChatGPT 앱 목록에서 `딱담아`를 선택합니다.
3. Chrome 딱담아에서 `연결하기`를 누릅니다.
4. 표시된 6자리 코드를 ChatGPT 딱담아 화면에 한 번 입력합니다.
5. ChatGPT에서 쇼핑 목록을 정리해 `확장 프로그램으로 보내기`를 누릅니다.
6. Chrome 딱담아에서 실제 상품, 가격, 묶음과 수량을 확인한 뒤 장바구니 담기를 승인합니다.
7. 열린 쿠팡 장바구니에서 상품과 최종 금액을 확인하고 사용자가 직접 결제합니다.

일반 사용자는 Node.js, 터널, MCP 주소, OpenAI API 키 또는 쿠팡 파트너스 키를 입력하지 않습니다.

## 출시 전 비공개 베타

Web Store와 ChatGPT 앱 공개 심사가 끝나기 전에는 개발자 배포 ZIP을 설치하고 비공개 ChatGPT 앱을 사용합니다. 이 경우에도 사용자는 서버 주소나 비밀키를 입력하지 않으며, 배포된 확장 프로그램에 공개 서버 주소가 미리 포함됩니다.

## 개발자

- 로컬 개발: `setup-windows.bat` → `start-windows.bat`
- 공개 Worker 배포: `docs/DEPLOYMENT_KO.md`
- ChatGPT 앱 등록·검증: `docs/GPT_APP_SETUP_KO.md`
- Chrome 확장 프로그램 설치·제출: `docs/CHROME_EXTENSION_SETUP_KO.md`
- 쿠팡 파트너스 설정: `docs/COUPANG_PARTNERS_SETUP_KO.md`

자동 결제, 바로구매와 주문 확정은 구현하지 않습니다.
