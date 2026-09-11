# API 미설정 fallback

쿠팡 파트너스 키는 딱담아 기능을 강화하지만, 앱 사용의 선행 조건은 아닙니다.

- 키가 없을 때 `POST /api/plans/:planId/resolve`는 오류 대신 `fallback: "BROWSER_SEARCH"`와 편집 가능한 계획을 반환합니다.
- Android·웹·ChatGPT는 이를 일반 쿠팡 검색 링크로 표시하고, 제휴 링크라고 표시하지 않습니다.
- 공개 베타에서는 사용자가 실제 상품을 고른 뒤 일반 쿠팡 상품 페이지를 직접 열 수 있습니다. Chrome 확장프로그램의 자동 검증·장바구니 실행은 정책 확인 전까지 비활성화합니다.
- 웹에서 Android 앱으로 넘길 때도 사용자가 명시적으로 허용한 `allowCanonicalFallback` execution만 만들며, 이 경우 앱 화면에 일반 쿠팡 URL 실행임을 표시합니다.
- 이후 파트너스 키를 등록하면 동일한 선택 흐름에서만 `affiliateUrl`을 생성하며, 확인된 링크만 제휴 링크로 표시합니다.

이 fallback은 결제·주문 자동화, CAPTCHA 우회, 쿠팡 로그인 정보 수집을 포함하지 않습니다.
