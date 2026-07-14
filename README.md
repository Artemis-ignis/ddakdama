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
- apps/worker: 다중 사용자용 Cloudflare Worker, Durable Object, 공개 MCP와 쿠팡 파트너스 adapter
- apps/server: 로컬 개발용 MCP 서버와 공용 ChatGPT 위젯 소스
- packages/core: 파서, 수량 계획, 장바구니 결과 요약
- docs: 설치, GPT 앱, 파트너스, 보안과 설계 문서

## 시작

일반 사용자는 공개된 Chrome 확장 프로그램과 ChatGPT 딱담아 앱만 사용합니다. 로컬 서버, 터널 또는 API 키를 설정하지 않습니다. 공개 심사 전 개발자는 `setup-windows.bat`을 실행한 뒤 Chrome에서 `apps/extension` 폴더 하나만 불러옵니다. `apps/extension/dist`는 매니페스트가 없는 빌드 산출물 폴더이므로 선택하지 않습니다.

초보자용 문서는 [START_HERE_KO.md](START_HERE_KO.md), [Windows 설치](docs/INSTALL_WINDOWS_KO.md), [Chrome 설정](docs/CHROME_EXTENSION_SETUP_KO.md), [GPT 앱 설정](docs/GPT_APP_SETUP_KO.md), [문제 해결](docs/TROUBLESHOOTING_KO.md) 순서로 확인합니다.

개발 명령:

    pnpm install
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm test:e2e
    pnpm build
    pnpm package

`pnpm package`가 만드는 배포물:

- `dist/ddakdama-extension-v1.0.0.zip`: 공개 HTTPS 서버가 주입된 단일 Chrome 확장 패키지(비공개 베타·Web Store 공용)
- `dist/ddakdama-server-v1.0.0.zip`: MCP·handoff·파트너스 서버
- `dist/ddakdama-cloudflare-worker-v1.0.0.zip`: 다중 사용자 공개 Worker 배포 소스
- `dist/ddakdama-chatgpt-app-v1.0.0.zip`: GPT 앱 서버와 설치 문서
- `dist/ddakdama-full-v1.0.0.zip`: 전체 소스·테스트·문서
- `dist/SHA256SUMS.txt`: 모든 ZIP의 SHA-256 체크섬

출시 전 비공개 베타 사용자는 `dist/ddakdama-extension-v1.0.0.zip`만 설치합니다. 공개 출시 후에도 같은 소스·같은 패키지를 Chrome Web Store에 제출합니다. `pnpm package`는 `VITE_DDAKDAMA_SERVER_ORIGIN`에 유효한 공개 HTTPS 주소가 없으면 실패하며, 공개 패키지의 파트너스 기능은 정책 검토가 끝날 때까지 강제로 비활성화합니다. 테스트용 확장 복제본과 프리뷰 빌드는 운영 폴더에 만들지 않고 Windows 임시 폴더에서 실행 후 정리합니다.

## 현재 검증 범위

- 자동 테스트: 파서, 수량 계산, 부분 실패, HMAC, 페어링·handoff, 사용자 UI 계약
- 실제 화면: 420px Side Panel 렌더링과 핵심 상호작용
- 실제 쿠팡: 검색 결과에서 productId, vendorItemId, 제목, 현재가, 묶음 수량 파싱
- 라이브 장바구니 추가는 사용자 승인과 로그인된 Chrome 환경에서 별도 검증하며, 검증하지 않은 결과를 완료로 표시하지 않음
- 쿠팡 파트너스 API 키는 최종 승인 파트너 계정에서만 발급 가능

자세한 내용은 START_HERE_KO.md와 docs/BASELINE_AUDIT.md를 참조하세요.
