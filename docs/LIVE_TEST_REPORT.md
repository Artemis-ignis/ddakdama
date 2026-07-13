# 라이브 테스트 보고서

검증일: 2026-07-13

## VERIFIED

- Chrome 개발자 모드에서 `apps/extension` 단일 폴더 설치
- 실제 쿠팡 검색 화면에서 상품명, productId, vendorItemId, 가격과 묶음 정보 읽기
- 로그인된 실제 쿠팡에서 고정 목록 5종을 각각 검색하고 정확 후보 5종의 판매가 확인
- 실제 상세페이지 5종에서 productId·vendorItemId·상품명·선택 규격·현재가·재고·장바구니 버튼 확인
- 검색 카드 배송비 오인 제거 후 확인가: 닥터지 14,360원, 스킨1004 43,890원, 라운드랩 18,620원, TS 11,540원, 닥터스베스트 36,800원
- 상세 구매 영역 밖 검색 카테고리를 제외한 결과, 잘못된 필수 옵션 판정 0/5
- 로컬 MCP 서버 health와 원격 HTTPS health
- 6자리 페어링 코드, 계획 전송, 기기 토큰 수신과 ACK
- Playwright 번들 Chromium에서 확장 로드와 MV3 서비스 워커 발견
- 동적 extension ID의 실제 Side Panel 페이지 로드
- Side Panel 컴포넌트의 후보·사전검사·전체 성공·부분 실패 시나리오
- 실제 Chrome 플러그인으로 최종 부분 실패 화면의 실패 1종 재시도, 2개 묶음의 실물 2개 표기, 일반 UI의 MCP·서버 URL 미노출 확인
- 실제 Chrome 플러그인으로 `연결하기` 클릭 후 6자리 코드와 `목록 받기` 동작 확인
- 고정 목록 5종·실물 7개 파싱과 100mg/240정 분리
- 현재 로그인된 ChatGPT Pro 계정의 실제 화면에서는 Developer mode/Create 메뉴가 노출되지 않는 상태 확인(공식 지원 범위와 별개의 계정별 관찰)

## FIXTURE_VERIFIED

- 단품과 2개 묶음 수량 계산, 3개 묶음 자동 선택 차단
- 4/5 성공 시 PARTIAL_FAILURE
- 서비스 워커 작업 재개 시 목표 수량 기준 남은 수량만 처리
- Product Search API 실패 시 브라우저 검색 fallback
- Deep Link 실패 시 일반 쿠팡 URL fallback
- GPT 앱 MCP 도구 스키마와 위젯 번들
- 최신 쿠팡 구매 영역 가격 selector의 지연 렌더링·미끼 가격 배제
- 실제 쿠팡 검색 카드의 배송비·적립금 제외는 라이브 확인, 장바구니 변경은 fixture 검증

## USER APPROVAL REQUIRED

- 실제 장바구니 변경과 productId별 수량 delta 확인
- 쓰기 도구를 허용하는 Business 또는 Enterprise/Edu 워크스페이스에서 ChatGPT 사용자 정의 앱 생성

## BLOCKED BY EXTERNAL ACCOUNT STATE

- 현재 로그인된 ChatGPT Pro 계정 화면에는 Developer mode/Create 메뉴가 노출되지 않으며, Pro는 공식적으로 읽기·검색 MCP만 지원하므로 딱담아의 쓰기 도구 전체 흐름은 검증할 수 없음
- 쿠팡 파트너스 계정이 최종 승인 상태가 아니어서 실제 API 키 발급·호출 미검증

## 공식 해결 경로

1. ChatGPT Business 워크스페이스를 사용하고 관리자/소유자 권한으로 `Workspace settings → Apps → Create`에서 앱을 만듭니다.
2. 또는 Enterprise/Edu 관리자가 Connected Data의 Developer mode 권한을 부여한 뒤 Apps 고급 설정에서 활성화합니다.
3. 공개 HTTPS MCP URL을 등록하고 비공개 개발 앱으로 테스트합니다.
4. Pro에서는 공식적으로 읽기·검색 MCP만 연결할 수 있습니다. 메뉴를 강제로 노출하거나 내부 API를 호출하는 우회 방식은 사용하지 않습니다.
