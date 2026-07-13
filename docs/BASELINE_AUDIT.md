# 기존 구현 감사

감사일: 2026-07-13

## 확인된 원인

- 기존 소스는 extension과 gpt-app의 단일 JavaScript 구조이며 버전이 0.2.0으로 남아 있었다.
- 여러 한국어 문자열이 잘못된 문자 인코딩으로 저장되어 사용자 문구와 DOM 선택자 신뢰성이 훼손됐다.
- 제품 규격과 구매수량이 단순 숫자 추출에 의존해 100mg 240정 같은 입력을 안정적으로 구분할 수 없었다.
- 가격 확인, 상세 상품 검증, 장바구니 수량 변화 검증이 하나의 명확한 상태 머신으로 연결되지 않았다.
- GPT 앱은 장기 페어링과 일회성 handoff 대신 URL payload 전달에 의존했다.
- 사용자 화면에 연결 서버와 개발 설정이 노출되는 구조였다.

## 결정

- 기존 코드는 참고용으로 보존하고 apps와 packages TypeScript 모노레포를 새 production 경로로 사용한다.
- 핵심 파서와 수량 계산은 packages/core로 분리해 확장 프로그램과 MCP 서버가 같은 규칙을 공유한다.
- 쿠팡 DOM 선택자는 중앙 content script에 두며, 가격 미확인·옵션 필요·품절은 자동 담기를 차단한다.
- 공개 Chrome Web Store 빌드에서는 직접 사용자 혜택이 구현되기 전까지 제휴 링크 삽입을 비활성화한다.

## 라이브 계정이 필요한 항목

- 최신 쿠팡 검색·상세·장바구니 DOM의 실제 선택자
- 로그인된 장바구니의 productId/vendorItemId별 수량 delta
- 쿠팡 파트너스 계정의 API 사용 권한과 공식 Product Search/Deep Link 규격
- ChatGPT Developer Mode에서 공개 HTTPS MCP endpoint 등록
