# 딱담아 v1.0.0 Production Beta

- 단일 `apps/extension` 설치 구조와 상대 자산 경로
- GPT 앱 6자리 페어링, 계획 전송·수신·ACK
- 실제 쿠팡 후보 비교와 수량 불일치·가격 미확인 차단
- 담기 전 이중 승인과 productId 장바구니 수량 delta 검증
- Windows 설치·서버·터널·패키징 도구 및 초보자 문서
- Vite·Vitest·esbuild 보안 패치, 알려진 취약점 0개

- TypeScript pnpm 모노레포로 재구성
- 100mg, 240정, 구매수량을 구분하는 한국어 쇼핑 목록 파서
- 단품과 묶음 상품의 정확한 실물수량 계산
- 실제 쿠팡 검색 후보의 productId, vendorItemId, 현재가와 묶음 파싱
- 가격 미확인·품절·필수 옵션·상품 불일치 자동 담기 차단
- 장바구니 담기 전후 productId별 수량 delta 검증
- 일부 실패를 전체 성공으로 표시하지 않는 결과 모델
- Apple의 절제와 Toss의 명료성을 참고한 독자적 Side Panel 디자인
- OpenAI Apps SDK MCP 도구 6개와 ChatGPT 위젯
- 일회용 기기 페어링, TTL handoff와 idempotency
- 쿠팡 파트너스 HMAC, 상품 검색과 Deep Link adapter
- Windows 설치·진단·패키징 스크립트

라이브 장바구니 변경, ChatGPT Developer Mode 등록과 실제 파트너스 키 호출은 계정 승인 및 사용자 최종 확인이 필요한 검증 항목입니다.
