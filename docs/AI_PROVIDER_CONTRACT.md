# AI 제공자 계약

Android의 직접 목록 입력은 항상 기본 경로다. AI는 목록 문장을 정리하거나 누락된 규격을 질문하는 선택 기능이며, 사용자의 상품·수량을 자동 확정하지 않는다.

## 서버 전용 Gemini adapter

- `GEMINI_API_KEY`는 Worker secret으로만 둔다.
- Android·웹·ChatGPT 위젯에는 Gemini key를 전달하지 않는다.
- 설정 전에는 `AI_PROVIDER_UNAVAILABLE`을 반환하고, 임의의 상품·가격·배송 정보를 생성하지 않는다.
- 설정 후에는 Gemini `generateContent` REST API를 서버에서 호출하고, 모델 출력은 `suggestedShoppingList` 초안으로만 반환한다.
- 사용자가 초안을 목록 입력창에서 확인·수정한 뒤에만 `CartPlan`을 만든다.

## 운영 제한

- 요청 길이와 항목 수를 제한하고 사용자별 rate limit을 적용한다.
- 쿠팡 로그인·쿠키·결제 정보·파트너스 secret은 AI prompt에 포함하지 않는다.
- AI는 쿠팡 상품 후보·최종 가격·배송비·재고를 사실로 단정하지 않는다. 이 값은 파트너스 API 또는 쿠팡 상세/장바구니 검증만이 채운다.
