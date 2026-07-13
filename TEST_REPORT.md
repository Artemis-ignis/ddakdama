# 테스트 보고서

검증일: 2026-07-13

## 자동 검증

- ESLint: 통과
- TypeScript: 통과
- Vitest: 13/13 통과
- MCP HTTP 실연결 스모크 테스트: 페어링·계획 전송·수신·ACK 통과
- Vite 확장 프로그램 빌드: 통과
- MCP 서버 빌드: 통과
- ZIP 패키징 및 SHA-256 생성: 통과

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
