# 라이브 테스트 보고서

검증일: 2026-07-13

## VERIFIED

- Chrome 개발자 모드에서 `apps/extension` 단일 폴더 설치
- 실제 쿠팡 검색 화면에서 상품명, productId, vendorItemId, 가격과 묶음 정보 읽기
- 로컬 MCP 서버 health와 원격 HTTPS health
- 6자리 페어링 코드, 계획 전송, 기기 토큰 수신과 ACK
- Playwright 번들 Chromium에서 확장 로드와 MV3 서비스 워커 발견
- 동적 extension ID의 실제 Side Panel 페이지 로드
- Side Panel 컴포넌트의 후보·사전검사·전체 성공·부분 실패 시나리오
- 고정 목록 5종·실물 7개 파싱과 100mg/240정 분리
- 최신 ChatGPT Pro 계정 실제 화면에서 사용자 정의 앱 Developer mode/Create 메뉴가 제공되지 않는 상태 확인

## FIXTURE_VERIFIED

- 단품과 2개 묶음 수량 계산, 3개 묶음 자동 선택 차단
- 4/5 성공 시 PARTIAL_FAILURE
- 서비스 워커 작업 재개 시 목표 수량 기준 남은 수량만 처리
- Product Search API 실패 시 브라우저 검색 fallback
- Deep Link 실패 시 일반 쿠팡 URL fallback
- GPT 앱 MCP 도구 스키마와 위젯 번들

## USER APPROVAL REQUIRED

- 고정 목록 5종의 실제 쿠팡 후보 최종 선택
- 실제 장바구니 변경과 productId별 수량 delta 확인
- Business 또는 Enterprise/Edu 워크스페이스에서 ChatGPT 사용자 정의 앱 생성

## BLOCKED BY EXTERNAL ACCOUNT STATE

- 현재 로그인된 ChatGPT 계정은 Pro 개인 계정이므로 공식 Developer mode/Create 메뉴를 사용할 수 없음
- 쿠팡 파트너스 계정이 최종 승인 상태가 아니어서 실제 API 키 발급·호출 미검증

## 공식 해결 경로

1. ChatGPT Business 워크스페이스를 사용하고 관리자/소유자 권한으로 `Workspace settings → Apps → Create`에서 앱을 만듭니다.
2. 또는 Enterprise/Edu 관리자가 Connected Data의 Developer mode 권한을 부여한 뒤 Apps 고급 설정에서 활성화합니다.
3. 공개 HTTPS MCP URL을 등록하고 비공개 개발 앱으로 테스트합니다.
4. Pro 전용 화면에 존재하지 않는 메뉴를 강제로 노출하거나 내부 API를 호출하는 우회 방식은 사용하지 않습니다.
