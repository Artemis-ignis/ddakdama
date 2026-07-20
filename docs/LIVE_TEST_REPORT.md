# 라이브 테스트 보고서

검증일: 2026-07-20 (이전 라이브 관찰과 현재 v1.0.2 회귀 검증을 구분해 기록)

## VERIFIED

- Chrome 개발자 모드에서 `apps/extension` 단일 폴더 설치
- 실제 쿠팡 검색 화면에서 상품명, productId, vendorItemId, 가격과 묶음 정보 읽기
- 로그인된 실제 쿠팡에서 고정 목록 5종을 각각 검색하고 정확 후보 5종의 판매가 확인
- 실제 상세페이지 5종에서 productId·vendorItemId·상품명·선택 규격·현재가·재고·장바구니 버튼 확인
- 검색 카드 배송비 오인 제거 후 확인가: 닥터지 14,360원, 스킨1004 43,890원, 라운드랩 18,620원, TS 11,540원, 닥터스베스트 36,800원
- 상세 구매 영역 밖 검색 카테고리를 제외한 결과, 잘못된 필수 옵션 판정 0/5
- 로컬 MCP 서버 health(`http://127.0.0.1:8787/health`)
- Cloudflare Worker 로컬 런타임 health와 공개 랜딩·개인정보·약관·지원 페이지
- Platform의 `딱담아 로컬 MCP` 터널 생성 및 개인 ChatGPT 워크스페이스 연결
- 공식 `openai/tunnel-client` v0.0.10 설치, SHA-256 검증과 로컬 터널 프로필 생성
- `tunnel-client doctor`에서 런타임 API 키 미설정 외 모든 구성 검사 통과
- 6자리 페어링 코드, 계획 전송, 기기 토큰 수신과 ACK
- Cloudflare Worker 런타임에서 고정 목록 5종·실물 7개 페어링·전송·ACK·연결 해제
- 고정 HTTPS Worker `https://ddakdama.ddakdama.workers.dev` 공개 배포
- 공개 `/health` 응답과 공개 `/mcp`의 5종·실물 7개 페어링·전송·ACK·연결 해제
- 공개 Durable Object에서 두 사용자 계획이 섞이지 않는 다중 사용자 격리
- 서로 다른 두 사용자 연결에서 각 장바구니 계획이 교차 노출되지 않는 격리 스모크 테스트
- 연결 코드 발급의 전역 IP별 rate limit 스모크 테스트: 10회 허용, 11번째 429 차단
- Playwright 번들 Chromium에서 확장 로드와 MV3 서비스 워커 발견
- 동적 extension ID의 실제 Side Panel 페이지 로드
- Side Panel 컴포넌트의 후보·사전검사·전체 성공·부분 실패 시나리오
- 실제 Chrome 플러그인으로 최종 부분 실패 화면의 실패 1종 재시도, 2개 묶음의 실물 2개 표기, 일반 UI의 MCP·서버 URL 미노출 확인
- 실제 Chrome 플러그인으로 `연결하기` 클릭 후 6자리 코드와 `목록 받기` 동작 확인
- 고정 목록 5종·실물 7개 파싱과 100mg/240정 분리
- ChatGPT에서 딱담아 Apps SDK 앱 생성과 아이콘 적용

## FIXTURE_VERIFIED

- 단품과 2개 묶음 수량 계산, 3개 묶음 자동 선택 차단
- 4/5 성공 시 PARTIAL_FAILURE
- 서비스 워커 작업 재개 시 목표 수량 기준 남은 수량만 처리
- Product Search API 실패 시 브라우저 검색 fallback
- Deep Link 실패 시 일반 쿠팡 URL fallback
- GPT 앱 MCP 도구 스키마와 위젯 번들
- 최신 쿠팡 구매 영역 가격 selector의 지연 렌더링·미끼 가격 배제
- 실제 쿠팡 검색 카드의 배송비·적립금 제외는 라이브 확인, 장바구니 변경은 fixture 검증

## USER ACTION REQUIRED

- 실제 장바구니 변경과 productId별 수량 delta 확인
- 실제 장바구니 검증 후 추가된 테스트 상품을 유지할지 제거할지 선택
- ChatGPT 딱담아 앱의 기존 임시 Server URL을 `https://ddakdama.ddakdama.workers.dev/mcp`로 교체

## BLOCKED BY EXTERNAL ACCOUNT STATE

- 쿠팡 파트너스 계정이 최종 승인 상태가 아니어서 실제 API 키 발급·호출 미검증

## 다음 실제 검증 경로

1. ChatGPT 앱의 Server URL을 `https://ddakdama.ddakdama.workers.dev/mcp`로 전환합니다.
2. 공개 패키지 확장 프로그램을 다시 불러옵니다.
3. 페어링 코드와 고정 쇼핑 목록으로 ChatGPT 앱 → 확장 프로그램 handoff를 검증합니다.
4. 사용자 승인 후 실제 쿠팡 장바구니 수량 delta를 검증합니다.

공식 문서: https://developers.openai.com/apps-sdk/deploy

## 2026-07-16 재검증

### VERIFIED

- 공개 Worker v8 위젯 배포: `ui://widget/ddakdama-cart-v8.html`
- 기존 v7·v6·v5 위젯 URI가 v8과 같은 리소스를 반환하는 하위 호환 확인
- 공개 `/health`: `ok=true`, `status=available`
- 공개 MCP에서 페어링 전 `connected=false`, 실제 GPT 앱 도구 연결 후 `connected=true`, 연결 해제 후 기기 토큰 `401` 확인
- 같은 위젯 nonce로 페어링 응답을 재시도할 때 동일한 연결 grant를 복구하고 다른 nonce는 거부
- 공개 MCP에서 고정 목록 5종·실물 7개 파싱, 계획 전송, 기기 수신, ACK, 상태 확인, 연결 해제와 토큰 폐기
- Cloudflare Worker 배포 버전 `9f29a244-b8ad-4ccd-a94b-77baab0eb12c`
- 확장 프로그램·서버·Worker 린트, 타입 검사, 프로덕션 빌드 통과
- 단위 테스트 69개 통과: core 11, extension 30, server 24, worker 4
- Chromium UI·확장 검증 35개 통과: preview 22, extension fixture 12, 공개 서버 실연결 1
- 라이트·다크·시스템 테마, 후보 변경, 상품 제외·재포함, 수량 변경, 가격 합계, 재연결 코드, 부분 실패, 새 목록 시작 화면 검증
- 완료 화면에서 `쿠팡 장바구니 보기`와 `새 목록 담기`를 별도 동작으로 제공하고 자동 탭 전환 제거
- 공개 배포 ZIP 5종 생성 및 `.env`, 로그, `node_modules` 미포함 확인
- `pnpm audit --audit-level high`: 알려진 취약점 0개

### FIXTURE_VERIFIED

- 실제 Chromium 확장 환경에서 상세 가격 검증, 묶음 수량 delta, 재개 시 중복 추가 방지, 비정상 거대 가격 차단
- 후보가 없을 때 행별 검색어 수정과 수동 후보 선택, 선택 단계에서 품목 제외·재포함
- 완료 화면 가격 합계, 장바구니 바로가기, 새 목록 시작

### NOT VERIFIED

- 새로 등록할 ChatGPT 플러그인 UI에서 v8 위젯을 직접 불러온 최종 화면
- 로그인된 실제 쿠팡 장바구니에서 이번 빌드의 상품별 수량 delta
- 쿠팡 파트너스 실제 전환 및 수수료 인정

## 2026-07-17 최종 재검증

이 절은 위의 2026-07-16 상태를 대체하는 최신 결과입니다.

### VERIFIED

- 공개 MCP 현재 위젯 `ui://widget/ddakdama-cart-v12.html`과 기존 v11~v5 호환 리소스 응답
- 실제 ChatGPT 공개 v12 위젯에서 고정 목록 5종·실물 7개 렌더링, 6자리 페어링, 계획 전송, 확장 수신 상태, 연결 해제 확인
- 실제 MV3 확장 프로그램이 공개 MCP에서 연결 코드를 발급하고 동일 코드로 페어링한 뒤 5종·실물 7개 목록을 수신·ACK하고 연결 해제 후 device token이 401이 되는 E2E
- 실제 Side Panel UI에서 후보 검색, 첫 품목 제외·재포함, 상세검증 5/5, 5종 담기, 92,250원 완료 합계, 장바구니 열기, 새 목록 시작 흐름
- 프로덕션 `apps/extension/dist`와 테스트 `output/extension-test-dist` 빌드 분리 및 설치 스크립트의 항상 최신 빌드 동작
- ESLint, TypeScript, 프로덕션 빌드 통과
- Vitest 94/94 통과: core 25, extension 37, server 28, worker 4
- 관련 MV3 확장 프로그램 Playwright E2E 기본 환경 13개 통과·2개 의도적 skip; `DDAKDAMA_LIVE_PAIRING=1` 새 clone 검증에서는 공개 MCP 페어링 포함 15/15 통과
- 새 clone preview UI 회귀 24/24 통과: 후보 검색 실패 후 검색어 수정·재시도와 테마/시각 회귀 포함
- `pnpm audit --prod`: 알려진 취약점 0개

### FIXTURE_VERIFIED

- 실제 background 상태 머신의 상세가격 재검증, 묶음 수량 계산, 장바구니 수량 delta, 서비스 워커 재개 시 중복 추가 방지
- 상품 제외·재포함, 가격 합계, 완료 후 장바구니 열기와 새 목록 시작
- 부분 실패, 가격 미확인, 규격 불일치, 필수 옵션, 로그인·보안 확인 분기

### NOT VERIFIED

- 사용자의 로그인된 Chrome 프로필에서 이번 최신 `dist`를 다시 로드한 뒤 실제 쿠팡 장바구니를 변경하고 productId별 수량 delta를 확인하는 마지막 라이브 실행
- 승인된 쿠팡 파트너스 API 키로 실제 Product Search·Deep Link·전환을 확인하는 작업
