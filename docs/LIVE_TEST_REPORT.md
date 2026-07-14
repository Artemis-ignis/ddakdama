# 라이브 테스트 보고서

검증일: 2026-07-14

## VERIFIED

- Chrome 개발자 모드에서 `apps/extension` 단일 폴더 설치
- 실제 쿠팡 검색 화면에서 상품명, productId, vendorItemId, 가격과 묶음 정보 읽기
- 로그인된 실제 쿠팡에서 고정 목록 5종을 각각 검색하고 정확 후보 5종의 판매가 확인
- 실제 상세페이지 5종에서 productId·vendorItemId·상품명·선택 규격·현재가·재고·장바구니 버튼 확인
- 검색 카드 배송비 오인 제거 후 확인가: 닥터지 14,360원, 스킨1004 43,890원, 라운드랩 18,620원, TS 11,540원, 닥터스베스트 36,800원
- 상세 구매 영역 밖 검색 카테고리를 제외한 결과, 잘못된 필수 옵션 판정 0/5
- 로컬 MCP 서버 health(`http://127.0.0.1:8787/health`)
- Platform의 `딱담아 로컬 MCP` 터널 생성 및 개인 ChatGPT 워크스페이스 연결
- 공식 `openai/tunnel-client` v0.0.10 설치, SHA-256 검증과 로컬 터널 프로필 생성
- `tunnel-client doctor`에서 런타임 API 키 미설정 외 모든 구성 검사 통과
- 6자리 페어링 코드, 계획 전송, 기기 토큰 수신과 ACK
- Playwright 번들 Chromium에서 확장 로드와 MV3 서비스 워커 발견
- 동적 extension ID의 실제 Side Panel 페이지 로드
- Side Panel 컴포넌트의 후보·사전검사·전체 성공·부분 실패 시나리오
- 실제 Chrome 플러그인으로 최종 부분 실패 화면의 실패 1종 재시도, 2개 묶음의 실물 2개 표기, 일반 UI의 MCP·서버 URL 미노출 확인
- 실제 Chrome 플러그인으로 `연결하기` 클릭 후 6자리 코드와 `목록 받기` 동작 확인
- 고정 목록 5종·실물 7개 파싱과 100mg/240정 분리
- ChatGPT에서 딱담아 Apps SDK 앱 생성과 아이콘 적용

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
- 터널 전용 API 키의 로컬 저장 승인 또는 Platform 키 생성 화면에서 `Create secret key`를 누른 뒤 키를 로컬 DPAPI 입력창에 한 번 붙여 넣기
- ChatGPT 앱 연결 방식을 `Tunnel`로 갱신하고 `딱담아 로컬 MCP` 선택

## BLOCKED BY EXTERNAL ACCOUNT STATE

- OpenAI Developers 연결은 복구되어 `IGNIS / 딱담아` 프로젝트 목록 조회까지 통과했지만, 로컬 키 저장 승인 단계가 `not_approved`를 반환하여 비밀키 생성·쓰기를 중단함
- 현재 등록된 GPT 앱은 만료된 임시 주소 `https://driver-icq-decrease-easter.trycloudflare.com/mcp`를 사용해 실호출 시 `UNAVAILABLE / Connection failed`가 발생함
- 터널 런타임 API 키가 아직 생성되지 않아 OpenAI 제어 평면 연결과 ChatGPT Tunnel 도구 호출은 미검증
- 쿠팡 파트너스 계정이 최종 승인 상태가 아니어서 실제 API 키 발급·호출 미검증

## 공식 해결 경로

1. `딱담아` Platform 프로젝트의 제한 키에 Tunnels `Read + Use`만 부여합니다.
2. `setup-tunnel-key-windows.bat`으로 키를 Windows DPAPI에 저장합니다.
3. `launch-windows.bat`으로 로컬 서버와 `tunnel-client`를 실행합니다.
4. ChatGPT 앱 설정에서 연결 방식 `Tunnel`과 `딱담아 로컬 MCP`를 선택합니다.
5. 페어링 코드와 고정 쇼핑 목록으로 handoff를 검증합니다.

공식 문서: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
