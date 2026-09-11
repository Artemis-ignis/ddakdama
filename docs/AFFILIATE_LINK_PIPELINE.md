# 쿠팡 파트너스 링크 파이프라인

검색 결과의 일반 상품 URL과 제휴 링크는 다른 값이다.

1. 상품 검색 결과는 `canonicalUrl`과 API 원본 `partnersSearchUrl`을 저장한다.
2. 후보를 고른 뒤에만 `canonicalUrl`을 딥링크 API에 보낸다.
3. HTTPS `landingUrl`을 받은 경우에만 `affiliateUrl`과 `affiliateVerified=true`을 저장한다.
4. 딥링크 실패는 일반 쿠팡 URL을 제휴 링크로 표시하지 않는다.
5. 확장프로그램은 검증된 `affiliateUrl`을 우선 열고, 없으면 명시된 일반 URL fallback만 사용한다.

Access Key와 Secret Key는 Worker secret에만 둔다. `AFFILIATE_API_ENABLED=false`이거나 키가 없으면 계획 생성은 가능하지만 제휴 링크 준비는 실패 상태를 반환한다.

파트너스 실적 인정과 모바일 WebView 장바구니 방식의 허용 여부는 실제 키·테스트 주문·쿠팡의 서면 확인으로 별도 검증해야 한다.
