# 테스트 보고서

검증일: 2026-07-13

## 자동 검증

- ESLint: 통과
- TypeScript: 통과
- Vitest: 22/22 통과 (core 6, extension 9, server 7)
- MCP HTTP 실연결 스모크 테스트: 페어링·계획 전송·수신·ACK 통과
- Vite 확장 프로그램 빌드: 통과
- MCP 서버 빌드: 통과
- ZIP 패키징 및 SHA-256 생성: 통과
- 배포 ZIP 구조 검사: 매니페스트 1개, 서버 core workspace 포함, 실제 비밀파일·node_modules 미포함
- pnpm audit: 알려진 취약점 0개
- Vite 8.1.4, Vitest 4.1.10, esbuild 0.28.1 패치 버전 검증
- Playwright 번들 Chromium 확장 E2E: 3/3 통과
- 실제 Side Panel 컴포넌트 프리뷰 E2E·시각 스냅샷: 6/6 통과
- MV3 서비스 워커, 동적 extension ID, Side Panel, storage, runtime message, content script 검증
- 전체 자동 검증: Vitest 22개 + Playwright 9개, 총 31개 통과
- 파트너스 Product Search/Deep Link 응답 정규화와 일반 링크 fallback 테스트 통과
- 상세페이지 사전검사, SKU URL gate, 장바구니 작업 재개·중복 방지 단위 테스트 통과

## 라이브 읽기 검증

- 쿠팡 로그인 상태 확인
- 실제 검색 결과에서 productId와 vendorItemId 추출
- 실제 상품명·현재가·묶음수량 파싱
- 쿠팡 파트너스 공식 V1 products/search 및 deeplink 문서 확인
- 쿠팡 파트너스 공식 V2 reco endpoint 확인

## 사용자 승인 후 검증

- 개발자 모드에서 확장 프로그램 설치: 완료
- 고정 목록 5종의 전체 실제 검색
- 장바구니 변경 전 최종 승인
- 상품 5종의 실제 수량 delta
- ChatGPT Developer Mode 앱 등록
- 최종 승인 파트너 계정의 API 키 발급 및 실제 호출
