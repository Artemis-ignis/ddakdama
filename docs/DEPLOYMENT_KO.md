# 공개 배포 안내

딱담아 운영 환경은 Cloudflare Worker, SQLite Durable Object, Chrome 확장 프로그램과 ChatGPT 앱으로 구성됩니다.

## 1. Cloudflare Worker

```powershell
pnpm install
pnpm --filter @ddakdama/worker lint
pnpm --filter @ddakdama/worker typecheck
pnpm --filter @ddakdama/worker test
pnpm --filter @ddakdama/worker run deploy
```

Cloudflare 계정 이메일 인증이 완료되어 있어야 합니다. 배포가 끝나면 Wrangler가 출력한 `https://...workers.dev` 주소를 기록합니다.

현재 운영 주소:

```text
https://ddakdama.ddakdama.workers.dev
```

이메일 인증과 최초 `workers.dev` 서브도메인이 준비된 뒤에는 루트의 `resume-public-release-windows.bat`으로 배포, 공개 MCP 검사, 전체 테스트, 단일 패키징과 배포물 검증을 한 번에 실행할 수 있습니다.

검증:

```powershell
$env:DDAKDAMA_TEST_ORIGIN = "https://ddakdama.ddakdama.workers.dev"
node apps/server/tests/mcp-smoke.mjs
node apps/server/tests/mcp-multiuser-smoke.mjs
```

이 검사는 공개 MCP 연결, 위젯 리소스, 5종·실물 7개 파싱, 기기 페어링, 계획 전송, ACK, 연결 해제와 두 사용자 사이의 데이터 격리를 확인합니다.

## 2. Chrome 확장 프로그램

```powershell
$env:VITE_DDAKDAMA_SERVER_ORIGIN = "https://ddakdama.ddakdama.workers.dev"
pnpm --filter @ddakdama/extension build
pnpm package
```

운영 확장 프로그램 번들에는 공개 서버 origin만 들어가며 비밀키는 포함하지 않습니다. `pnpm package`는 공개 HTTPS 주소가 없으면 실패하고, 단일 `ddakdama-extension-v1.0.0.zip`에서 localhost 권한과 제휴 기능을 제거합니다. 비공개 베타와 Web Store 제출 모두 이 한 패키지를 사용합니다.

## 3. ChatGPT 앱

ChatGPT 앱의 Server URL은 다음으로 설정합니다.

```text
https://ddakdama.ddakdama.workers.dev/mcp
```

공개 베타는 앱 자체 계정을 만들지 않으므로 인증 없음으로 연결합니다. 사용자별 장바구니 계획은 6자리 일회용 코드와 무작위 연결 권한으로 분리합니다.

## 4. 쿠팡 파트너스

비밀키는 Cloudflare Secret으로만 저장합니다.

```powershell
pnpm --filter @ddakdama/worker exec wrangler secret put COUPANG_PARTNERS_ACCESS_KEY
pnpm --filter @ddakdama/worker exec wrangler secret put COUPANG_PARTNERS_SECRET_KEY
```

키가 없거나 API 호출이 실패하면 딱담아는 일반 쿠팡 브라우저 검색과 원본 상품 URL로 계속 동작합니다. 제휴 링크를 사용하면 사용자 화면에 수수료 고지를 표시해야 합니다.

## 5. 운영 보안

- `.env`, API 키와 토큰을 Git 또는 ZIP에 포함하지 않습니다.
- `ALLOWED_EXTENSION_IDS`에는 공개 Web Store 확장 프로그램 ID를 설정합니다.
- 공개 앱과 Web Store 제출 전 실제 지원 연락처를 `/support`에 추가합니다.
- Cloudflare 로그와 오류율을 모니터링합니다.
- 자동 결제와 주문 확정은 구현하지 않습니다.
- CAPTCHA와 쿠팡 보안 확인을 우회하지 않습니다.

## 6. 로컬 개발

`start-windows.bat`과 OpenAI Secure MCP Tunnel은 개발자 검증용 보조 경로입니다. 일반 사용자에게 로컬 서버나 API 키 설정을 요구하지 않습니다.
