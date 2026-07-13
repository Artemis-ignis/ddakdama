# 보안

- 자동 결제, 바로구매와 주문 확정은 구현하지 않습니다.
- 쿠팡 비밀번호, 카드정보와 세션 쿠키 원문을 읽거나 서버로 보내지 않습니다.
- CAPTCHA와 보안 확인을 우회하지 않습니다.
- Access Key와 Secret Key는 서버 환경변수에만 저장합니다.
- 실제 env 파일, 토큰, 로그와 장바구니 데이터는 Git과 배포 ZIP에서 제외합니다.
- handoff는 짧은 TTL, 일회성 ACK와 idempotency key를 사용합니다.
- Chrome 권한은 storage, tabs, scripting, sidePanel과 쿠팡 host 범위로 제한합니다.
- 제휴 링크는 사용자 동작과 명확한 고지 없이 삽입하지 않습니다.

보안 문제는 공개 이슈에 비밀정보를 포함하지 말고 저장소 관리자에게 비공개로 전달해 주세요.
