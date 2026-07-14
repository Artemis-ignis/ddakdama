# 테스트 보고서

검증일: 2026-07-14

## 자동 검증

- ESLint: 통과
- TypeScript strict 검사: 통과
- Vitest: 52/52 통과
  - core 11개
  - extension 17개
  - server 20개
  - Cloudflare Worker 4개
- Playwright 실제 Chromium: 26/26 통과
  - MV3 확장 프로그램·장바구니 상태 머신·탭 재사용 10개
  - 실제 Side Panel 컴포넌트·시각 회귀 16개
- 새 빌드를 격리된 로컬 포트에서 실행한 MCP HTTP 스모크 테스트: 통과
  - 페어링
  - 장바구니 계획 전송
  - 확장 프로그램 수신·ACK
  - 연결 해제 후 device token 폐기(401)
  - 고정 목록 5종·실물 7개 전달
- 프로덕션 빌드: 통과
- 이전 로컬 패키징과 SHA-256 생성: 통과. 최신 공개 단일 패키지는 고정 HTTPS Worker 배포 후 다시 생성·검증 예정
- 공식 `openai/tunnel-client` v0.0.10 다운로드와 SHA-256 검증: 통과
- Secure MCP Tunnel 프로필 생성 및 로컬 MCP health 확인: 통과
- 터널 전용 런타임 키는 Windows DPAPI에 저장되었고 제어 평면 인증을 통과
- Cloudflare Worker lint·typecheck·Vitest·dry-run 빌드 통과
- 공개 Worker 로컬 런타임의 `/health`, `/mcp`, `/privacy`, `/terms`, `/support` 확인
- 동일 클라이언트의 연결 코드 발급은 분산 shard와 무관하게 분당 10회만 허용되고 11번째 요청은 429로 차단
- 공개 HTTPS origin이 없으면 `pnpm package`가 배포 ZIP 생성을 차단하는 release guard 확인
- `pnpm audit --audit-level high`: 알려진 취약점 0개

## 핵심 회귀 검증

- 고정 입력 5행을 5개 요청, 실물 7개로 파싱
- `100mg`은 함량, `240정`은 병 규격, 기본 구매수량은 1병으로 구분
- `50mL 2개`를 단품 2개 또는 2개 묶음 1세트로 정확히 계획
- 3개 묶음 등 과잉 공급 후보 자동 선택 차단
- 브랜드·핵심 상품명·용량·함량·포장 규격을 분리 검증
- 가격 미확인과 필수 옵션 상품 자동 담기 차단
- productId·vendorItemId·itemId 복합 SKU로 장바구니 수량 delta 검증
- 기존 수량을 고려해 이번 실행의 증가량만 검증
- 같은 runId 재개 시 중복 추가 방지
- 서비스 워커 중단 journal을 Side Panel에서 복구 또는 폐기
- 4종 성공·1종 실패를 `PARTIAL_FAILURE`로 표시
- 사전검사 문제 상품을 몰래 제외하지 않고 명시적 부분 실행 승인 제공
- 상세페이지 확인가, 실제 장바구니 표시가, 차액을 구분
- content script가 import 없는 독립 IIFE 번들로 생성됨
- 서버 재시작 후 페어링·grant·handoff 상태 복원 테스트 통과
- 페어링 시도 제한과 연결 해제 시 관련 인증 상태 폐기 검증
- 최신 쿠팡 상세가격의 지연 렌더링과 구매 영역 밖 미끼 가격 배제 검증
- 검색 카드의 배송비·적립금이 판매가로 오인되지 않는 회귀 검증
- 상세 구매 영역 밖 검색 카테고리가 필수 옵션으로 오인되지 않는 회귀 검증
- 가격보다 늦게 렌더링되는 장바구니 버튼 재확인 검증
- 실제 스킨1004 `1+1 (+여행용 미니 증정), 2개, 50mL` 제목의 묶음 수량 검증
- 정확하지 않은 브랜드·제품명·용량·포장 후보의 자동 선택 차단
- 불일치 후보 직접 선택, 초과 묶음 경고, 후보 개수 표시와 검색어 수정·재검색 검증
- 실제 쿠팡 검색에서 `샘다수 2리터` 오타가 `삼다수 2L` 후보들을 반환하고 수동 선택 경로로 복구되는 것 확인
- 실제 쿠팡 DOM에서 `recently_viewed_widget` 링크를 제외하고 검색·광고 결과만 후보로 유지하는 필터 확인
- 부분 사전검사 CTA의 상품 종류·실물수량·금액 일치 검증
- 2개 묶음 결과의 실물 수량 설명과 부분 실패 재시도 우선순위 검증
- 공식 MCP Apps bridge 기반 위젯 도구 호출과 6자리 페어링 UI 계약 검증

## 검증 구분

### VERIFIED

- 코드 정적 검사, 단위·통합 테스트, 프로덕션 빌드
- Playwright bundled Chromium에서 MV3 서비스 워커, content script, Side Panel, 장바구니 상태 머신
- MCP 서버 로컬 실연결과 페어링·handoff·ACK·연결 해제
- Cloudflare Worker 로컬 런타임에서 5종·실물 7개 MCP·페어링·handoff·ACK·연결 해제
- 서로 다른 두 기기의 페어링·handoff를 동시에 실행해 5종·7개와 1종·3개가 섞이지 않는 사용자 격리 확인
- 공개 확장 빌드에서 파트너스 검색·딥링크·고지가 비활성화되는 정책 gate 확인
- 이전 개발용 패키지 구조와 SHA-256 체크섬. 최신 공개 단일 확장 ZIP은 Worker 배포 후 재검증 예정
- 로그인된 실제 쿠팡 검색 화면과 상세페이지에서 고정 목록 5종의 상품 식별자·판매가·재고·장바구니 버튼 확인

### FIXTURE_VERIFIED

- 최신 장바구니 행 DOM 파싱
- 실제 background 상태 머신의 상품별 수량 증가와 부분 실패 처리
- 보안 확인·로그인·필수 옵션·가격 미확인 분기

### BLOCKED / 사용자 승인 필요

- 로그인된 실제 쿠팡 장바구니 변경과 productId별 수량 delta 확인
- 승인된 쿠팡 파트너스 Access/Secret Key를 사용한 Product Search·Deep Link 호출
- Cloudflare 계정 이메일 인증 후 Worker 고정 HTTPS 주소 배포
- 고정 HTTPS `/mcp`를 ChatGPT 앱 Server URL로 연결한 실사용 검증

실계정에서 실행하지 않은 항목은 라이브 성공으로 간주하지 않습니다.
