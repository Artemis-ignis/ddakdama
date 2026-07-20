# 딱담아 데모 영상 업로드 안내

## 생성 파일

프로젝트 루트에서 아래 명령을 실행합니다.

~~~powershell
pnpm.cmd demo:record
~~~

생성 결과:

- `dist/demo/ddakdama-causal-demo-v1.0.2.mp4` — 1920×1080, 30fps, H.264/AAC 데모 영상(영문 음성·내장 자막)
- `dist/demo/ddakdama-causal-demo-v1.0.2.en.srt` — YouTube 접근성 자막 업로드용 영문 SRT
- `dist/demo/ddakdama-causal-demo-thumbnail.png` — YouTube 썸네일
- `dist/demo/ddakdama-causal-demo-contact-sheet.png` — 전체 구간 시각 검수용 접촉시트

영상은 하나의 브라우저 세션에서 실제 UI 버튼을 순서대로 누릅니다. 6자리 페어링 → ChatGPT 목록 전송 → 확장 프로그램 수신 → 후보 검색 → 품목 제외·복구 → 대체 후보 선택과 합계 변경 → 사전검사 → 사용자 승인 후 담기 → 성공 결과와 새 목록 시작까지 화면 상태가 인과적으로 이어집니다. 중간 상태를 정적 스크린샷이나 별도 경로로 교체하지 않습니다.

쿠팡 라이브 계정이나 결제를 가장하지 않도록 화면 하단에 `Fixture-backed demo · Checkout is never automated`를 계속 표시합니다. 가격과 장바구니 결과는 안전한 테스트 어댑터로 검증하며 결제는 자동화하지 않습니다.

## YouTube 권장 설정

Devpost 심사자가 링크로 볼 수 있도록 공개 범위는 **일부 공개(Unlisted)** 를 권장합니다. **비공개(Private)** 는 초대된 Google 계정만 볼 수 있어 심사 영상 URL로 사용할 수 없습니다.

- 제목: `DdakDama — Natural-language shopping lists to a verified cart plan`
- 공개 범위: `일부 공개`
- 아동용 여부: `아니요, 아동용이 아닙니다`
- 썸네일: `dist/demo/ddakdama-causal-demo-thumbnail.png`

설명:

~~~text
DdakDama turns a natural-language shopping list into a precise, reviewable cart plan.

The ChatGPT app separates product size, strength, package contents, and requested quantity, then hands the confirmed plan to a paired Chrome extension. The extension lets users compare candidates, adjust or exclude items, review estimated totals, run a preflight check, and approve cart changes. Checkout is never automated.

This recording demonstrates verified local UI and fixture-backed flows. Live store availability and final cart prices can change and are rechecked in the extension.
~~~

## 60초 시연 순서

1. 확장 프로그램에서 일회용 6자리 코드를 만들고 ChatGPT 앱에 입력
2. ChatGPT에서 5종·실물 7개 계획을 확장 프로그램으로 전송
3. 같은 화면에서 확장 프로그램이 전송 목록을 수신
4. 5종 후보를 실제 버튼으로 검색하고 합계 74,540원 표시
5. 닥터지 품목 제외 시 58,340원, 복구 시 74,540원으로 변경
6. 다른 후보 선택 시 67,736원으로 다시 변경
7. 가격·규격·재고·옵션·수량 사전검사 통과
8. 사용자가 최종 버튼을 누른 뒤에만 담기 실행
9. 5종 성공과 67,736원 결과 확인 후 `새 목록 담기`로 초기화

## 촬영 시 숨길 정보

- OpenAI API 키
- Cloudflare 토큰
- 쿠팡 파트너스 키
- 확장 프로그램 장기 토큰
- 개인 이메일, 쿠팡 계정, 주소, 장바구니 기존 상품

## GPT 앱 등록값

정확한 등록값은 `docs/GPT_APP_AND_EXTENSION_VALUES_KO.md`를 사용합니다. 일반 사용자는 API 키나 서버 주소를 확장 프로그램에 입력하지 않습니다.

## 영상이 실제 동작 증거가 되려면

이 자동 생성 영상은 실제 ChatGPT 위젯과 실제 Chrome 확장 UI를 하나의 연속 세션에서 조작하는 제출용 제품 데모입니다. 검색·가격·장바구니 구간은 재현 가능한 테스트 어댑터로 검증한 흐름이므로, 라이브 쿠팡 계정에서 실행한 것으로 표현하지 마십시오. 별도의 라이브 계정 영상을 촬영할 경우에도 결제는 진행하지 않고 개인정보와 기존 장바구니를 노출하지 마십시오.
