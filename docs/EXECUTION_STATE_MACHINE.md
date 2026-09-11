# 실행 상태 머신

`CartExecution`: `WAITING_FOR_DEVICE → READY → RUNNING → COMPLETED|PARTIALLY_COMPLETED|FAILED`.

각 항목은 `PENDING → OPENING_AFFILIATE_URL → VERIFYING_PRODUCT → ADDING_TO_CART → VERIFYING_CART_DELTA → ADDED`를 따른다. 가격 변경·옵션 선택은 `PRICE_CHANGED` 또는 `OPTION_REQUIRED`로 기록하고 execution을 `PAUSED_FOR_USER`로 전환한다.

로그인, 보안 확인, CAPTCHA는 우회하지 않는다. 사용자가 처리할 수 있도록 현재 화면을 유지하고 결과만 서버에 기록한다.
