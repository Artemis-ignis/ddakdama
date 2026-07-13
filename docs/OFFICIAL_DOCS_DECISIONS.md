# 공식 문서 기준 결정

확인일: 2026-07-13

## OpenAI Apps SDK

- 앱 유형은 interactive-decoupled로 분류했다.
- MCP 서버는 필수이며 UI는 검토·수정·전송 흐름을 실질적으로 개선하는 위젯으로만 사용한다.
- 신규 위젯은 MCP Apps ui 브리지와 tools/call을 기본으로 하고 ChatGPT 전용 기능은 window.openai 호환 표면에 한정한다.
- 도구는 read-only 여부, 외부 상태 변경 여부, idempotency를 명시한다.
- 대화에 필요한 값은 structuredContent, 위젯 전용 비밀 데이터는 meta로 분리한다.
- 개발자 모드 연결에는 공개 HTTPS /mcp 주소가 필요하다.

참고: https://developers.openai.com/apps-sdk/quickstart

## Chrome Web Store

- 제휴 프로그램은 설치 전, 스토어 설명, 사용자 UI에 명확히 고지해야 한다.
- 관련 사용자 동작과 직접적·투명한 사용자 혜택 없이 제휴 링크나 쿠키를 삽입하면 안 된다.
- 현재 private 빌드는 명시적 사용자 동작 후에만 적용할 수 있고, webstore 빌드는 실제 혜택이 구현되기 전까지 제휴 삽입을 차단한다.

참고: https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads/

## 쿠팡 파트너스

공개 검색으로 신뢰할 수 있는 최신 공식 API 규격을 확인하지 못했다. 판매자 WING API와 파트너스 API를 혼동하지 않기 위해 endpoint를 추측하지 않는다. 로그인 후 공식 파트너스 API 문서를 확인하고 계정 권한과 현재 규격이 확인된 뒤 실제 adapter를 활성화한다.
