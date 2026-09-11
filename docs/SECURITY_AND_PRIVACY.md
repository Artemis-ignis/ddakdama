# 보안 및 개인정보 경계

- 쿠팡 파트너스 API secret, device token, plan access token, 쿠팡 쿠키를 UI·로그·저장소에 노출하지 않는다.
- plan access token은 익명 계획 소유권 증명이다. URL query에 넣지 않고 Authorization header로 보낸다.
- execution claim token은 짧은 만료 execution과 한 기기 claim에만 사용한다.
- ChatGPT의 Android plan link도 plan access token을 노출하지 않고 단일 사용 claim token만 담는다. claim 뒤 Android에는 별도 capability를 발급하며, 원 claim token 재사용은 거부한다.
- Android WebView의 쿠팡 비밀번호·쿠키·결제 정보는 서버로 보내지 않는다.
- 자동 결제, 주문 확정, CAPTCHA 우회, 결제수단 접근은 제품 범위 밖이다.
