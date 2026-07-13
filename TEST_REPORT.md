# 테스트 보고서

검증일: 2026-07-13

## 자동 검증

- ESLint: 통과
- TypeScript strict 검사: 통과
- Vitest: 30/30 통과
  - core 9개
  - extension 10개
  - server 11개
- Playwright 실제 Chromium: 14/14 통과
  - MV3 확장 프로그램 6개
  - 실제 Side Panel 컴포넌트·시각 회귀 8개
- MCP HTTP 스모크 테스트: 통과
  - 페어링
  - 장바구니 계획 전송
  - 확장 프로그램 수신·ACK
  - 연결 해제 후 device token 폐기(401)
- 프로덕션 빌드: 통과
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

## 검증 구분

### VERIFIED

- 코드 정적 검사, 단위·통합 테스트, 프로덕션 빌드
- Playwright bundled Chromium에서 MV3 서비스 워커, content script, Side Panel, 장바구니 상태 머신
- MCP 서버 로컬 실연결과 페어링·handoff·ACK·연결 해제
- 개발용·Web Store 검토용 확장 ZIP, 서버·ChatGPT 앱·전체 ZIP 구조와 SHA-256 체크섬

### FIXTURE_VERIFIED

- 쿠팡 검색·상세·장바구니 DOM 파싱
- 상품별 수량 증가와 부분 실패 처리
- 보안 확인·로그인·필수 옵션·가격 미확인 분기

### BLOCKED / 사용자 승인 필요

- 로그인된 실제 쿠팡 계정에서 고정 목록 5종 검색과 장바구니 변경
- 실제 장바구니 추가 직전 사용자 승인
- 승인된 쿠팡 파트너스 Access/Secret Key를 사용한 Product Search·Deep Link 호출
- ChatGPT Developer Mode 등록: 현재 공식 요구사항상 Business·Enterprise·Edu 워크스페이스 필요

실계정에서 실행하지 않은 항목은 라이브 성공으로 간주하지 않습니다.
