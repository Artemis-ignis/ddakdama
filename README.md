# 딱담아

자연어 쇼핑 목록을 정확한 쿠팡 상품·규격·수량으로 확인하고, 사용자 승인 후 장바구니에 순차적으로 담는 Chrome 확장 프로그램과 ChatGPT 앱입니다.

## 핵심 원칙

- 제품 용량, 1회 함량, 포장 규격과 구매수량을 분리합니다.
- 가격을 확인하지 못한 상품은 자동으로 담지 않습니다.
- 상품마다 productId와 장바구니 수량 증가를 검증합니다.
- 일부 상품만 성공하면 전체 성공으로 표시하지 않습니다.
- 결제와 주문 확정은 자동화하지 않습니다.
- 서버 주소, MCP, 토큰과 API 키는 일반 사용자 화면에 노출하지 않습니다.

## 고정 검증 목록

다음 입력은 상품 5종, 실물 7개로 해석됩니다.

    닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml
    스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개
    라운드랩 1025 독도 클렌저 150ml 2개
    TS 골드플러스 샴푸 500g
    닥터스베스트 고흡수 마그네슘 100mg 240정

마지막 줄의 100mg은 함량, 240정은 한 병의 포장 규격, 요청수량은 1병입니다.

## 구조

- apps/extension: Manifest V3 Chrome Side Panel
- apps/server: OpenAI Apps SDK/MCP 서버, 페어링·handoff, 쿠팡 파트너스 adapter
- packages/core: 파서, 수량 계획, 장바구니 결과 요약
- docs: 설치, GPT 앱, 파트너스, 보안과 설계 문서

## 시작

Windows에서는 setup-windows.bat을 실행한 뒤 START_HERE_KO.md를 따릅니다.

개발 명령:

    pnpm install
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm package

## 현재 검증 범위

- 자동 테스트: 파서, 수량 계산, 부분 실패, HMAC, 페어링·handoff, 사용자 UI 계약
- 실제 화면: 420px Side Panel 렌더링과 핵심 상호작용
- 실제 쿠팡: 검색 결과에서 productId, vendorItemId, 제목, 현재가, 묶음 수량 파싱
- 라이브 장바구니 추가는 사용자의 최종 승인 후 별도 검증
- 쿠팡 파트너스 API 키는 최종 승인 파트너 계정에서만 발급 가능

자세한 내용은 START_HERE_KO.md와 docs/BASELINE_AUDIT.md를 참조하세요.
