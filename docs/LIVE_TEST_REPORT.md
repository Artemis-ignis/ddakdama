# 라이브 테스트 보고서

검증일: 2026-07-13

## VERIFIED

- Chrome 개발자 모드에서 `apps\extension` 단일 폴더 설치
- 실제 쿠팡 검색 화면의 상품명, productId, vendorItemId, 가격과 묶음 정보 읽기
- 로컬 MCP 서버 health
- 6자리 페어링, 계획 전송, 기기 토큰 수신, ACK
- Playwright 번들 Chromium에서 확장 로드와 MV3 서비스 워커 발견
- 동적 extension ID의 실제 Side Panel 페이지 렌더링
- chrome.storage.local과 runtime message
- 쿠팡 URL fixture에서 content script 자동 주입과 후보 구조화
- 상세페이지 fixture에서 가격·옵션·품절·상품 식별 사전검사
- 실제 Side Panel 컴포넌트의 후보·사전검사·전체 성공·부분 실패 시각 시나리오

## FIXTURE_VERIFIED

- 고정 목록 5종·실물 7개 파싱
- 100mg 함량과 240정 포장 규격 분리
- 단품·2개 묶음 수량 계산과 3개 묶음 차단
- 4/5 성공 시 PARTIAL_FAILURE
- 서비스 워커 작업 재개 시 목표 수량을 기준으로 남은 수량만 처리
- Product Search API 실패 시 브라우저 검색, Deep Link 실패 시 일반 쿠팡 URL fallback

## USER APPROVAL REQUIRED

- 고정 목록 5종 실제 검색 결과 최종 확인
- 장바구니 변경과 productId별 실제 수량 delta
- ChatGPT Developer Mode 원격 앱 등록

## BLOCKED BY EXTERNAL ACCOUNT STATE

- 쿠팡 파트너스 계정이 최종 승인 상태가 아니어서 실제 API 키 발급·호출 미검증
