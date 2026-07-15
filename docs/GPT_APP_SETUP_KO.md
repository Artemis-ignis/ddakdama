# ChatGPT 앱 설정

딱담아는 일반 Custom GPT가 아니라 OpenAI Apps SDK와 MCP로 만든 ChatGPT 앱입니다.

## 일반 사용자 경험

일반 사용자는 다음만 수행합니다.

1. ChatGPT 앱 목록에서 `딱담아`를 선택합니다.
2. Chrome 딱담아 확장 프로그램에서 `연결하기`를 누릅니다.
3. ChatGPT 딱담아 위젯에 일회용 6자리 코드를 입력합니다.
4. 확인한 쇼핑 목록을 `확장 프로그램으로 보내기`로 전송합니다.

일반 사용자에게 서버 URL, MCP URL, API 키, 기기 토큰 또는 내부 전송 ID를 노출하거나 입력받지 않습니다.

## 운영자 최초 등록

1. Cloudflare에 딱담아 Worker를 배포합니다.
2. `https://ddakdama.ddakdama.workers.dev/health`가 `ok: true`를 반환하는지 확인합니다.
3. MCP 클라이언트로 `https://ddakdama.ddakdama.workers.dev/mcp`의 도구와 위젯을 검증합니다.
4. ChatGPT Developer Mode의 앱/플러그인 관리에서 새 앱을 만듭니다.
5. 연결 방식은 `Server URL`, 인증은 현재 공개 베타에서 `인증 없음`을 선택합니다.
6. Server URL에는 `https://ddakdama.ddakdama.workers.dev/mcp`를 입력합니다.
7. 이름은 `딱담아`, 아이콘은 `apps/extension/assets/icon-256.png`를 사용합니다.
8. 앱을 저장한 뒤 새 채팅에서 고정 테스트 목록을 실행합니다.

딱담아는 별도 계정 로그인을 받지 않습니다. ChatGPT 앱과 Chrome 확장 프로그램은 짧게 유효한 6자리 코드와 무작위 기기 토큰으로 연결됩니다. 기기 토큰과 연결 권한은 30일 이내에 만료되며 사용자가 연결 해제하면 즉시 폐기됩니다.

## 고정 테스트 목록

```text
닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml
스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개
라운드랩 1025 독도 클렌저 150ml 2개
TS 골드플러스 샴푸 500g
닥터스베스트 고흡수 마그네슘 100mg 240정
```

기대 결과:

- 상품 5종
- 요청 실물 7개
- 마그네슘 `100mg`은 함량
- `240정`은 한 병의 포장 규격
- 마그네슘 구매수량은 1병
- 확장 프로그램이 계획을 받은 뒤 ACK 상태가 ChatGPT 위젯에 표시됨

## 공개 제출 전 확인

- 고정 HTTPS 도메인
- 개인정보 처리방침: `https://ddakdama.ddakdama.workers.dev/privacy`
- 이용약관: `https://ddakdama.ddakdama.workers.dev/terms`
- 사용자 지원: `https://ddakdama.ddakdama.workers.dev/support`
- 앱 아이콘과 스크린샷
- 도구 설명과 read/write annotation
- CSP와 연결 도메인
- 데이터 보관 기간
- 쿠팡 파트너스 고지
- 실제 지원 연락처

공개 앱 제출과 심사 요청은 운영자 계정에서 최종 확인 후 진행합니다.

## 개발용 로컬 경로

로컬 서버와 OpenAI Secure MCP Tunnel은 개발자가 배포 전 기능을 확인하는 용도입니다. 실제 사용자에게 `launch-windows.bat`, 터널 API 키 또는 로컬 MCP 서버 실행을 요구하지 않습니다.

- 로컬 서버: `http://127.0.0.1:8787`
- 로컬 MCP: `http://127.0.0.1:8787/mcp`
- 로컬 실행: `start-windows.bat`

운영 주소가 정상화되면 ChatGPT 앱은 로컬 터널이 아니라 고정 HTTPS `/mcp`를 사용합니다.
