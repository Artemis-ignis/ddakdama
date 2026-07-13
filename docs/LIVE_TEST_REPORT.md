# 라이브 테스트 보고서

검증일: 2026-07-13

## VERIFIED

- Chrome 개발자 모드에서 `apps\extension` 단일 폴더 설치
- 실제 쿠팡 검색 화면의 상품명, productId, vendorItemId, 가격과 묶음 정보 읽기
- 로컬 MCP 서버 health
- 6자리 페어링, 계획 전송, 기기 토큰 수신, ACK

## FIXTURE_VERIFIED

- 고정 목록 5종·실물 7개 파싱
- 100mg 함량과 240정 포장 규격 분리
- 단품·2개 묶음 수량 계산과 3개 묶음 차단
- 4/5 성공 시 PARTIAL_FAILURE

## USER APPROVAL REQUIRED

- 고정 목록 5종 실제 검색 결과 최종 확인
- 장바구니 변경과 productId별 실제 수량 delta
- ChatGPT Developer Mode 원격 앱 등록

## BLOCKED BY EXTERNAL ACCOUNT STATE

- 쿠팡 파트너스 계정이 최종 승인 상태가 아니어서 실제 API 키 발급·호출 미검증
