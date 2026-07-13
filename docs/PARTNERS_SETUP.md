# 쿠팡 파트너스 연동 설정

## 목표

딱담아에서 선택한 일반 쿠팡 상품 URL을 서버가 쿠팡 파트너스 딥링크로 변환하고, 변환하지 못한 상품은 일반 쿠팡 URL로 계속 처리합니다.

## 필요한 것

- 승인된 쿠팡 파트너스 계정
- 해당 계정에서 사용할 수 있는 Access Key와 Secret Key
- HTTPS로 배포된 딱담아 `gpt-app` 서버
- Chrome 확장 프로그램

API 제공 범위와 키 발급 가능 여부는 계정 상태에 따라 다를 수 있습니다.

## 서버 설정

`gpt-app/.env.example`을 참고해 환경변수를 등록합니다.

```bash
PORT=8787
PUBLIC_BASE_URL=https://ddakdama.example.com
WIDGET_DOMAIN=https://ddakdama.example.com

DDAKDAMA_EXTENSION_TOKEN=충분히-긴-무작위-토큰
DDAKDAMA_RATE_LIMIT_MAX=60
DDAKDAMA_RATE_LIMIT_WINDOW_MS=60000
DDAKDAMA_ALLOW_UNAUTHENTICATED_PARTNERS=false
COUPANG_PARTNERS_ACCESS_KEY=발급받은-access-key
COUPANG_PARTNERS_SECRET_KEY=발급받은-secret-key
COUPANG_PARTNERS_SUB_ID=ddakdama-main

COUPANG_PARTNERS_API_BASE_URL=https://api-gateway.coupang.com
COUPANG_PARTNERS_DEEPLINK_PATH=/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink
```

API 경로는 환경변수로 분리되어 있습니다. 계정의 최신 공식 포털 문서에 다른 경로가 표시되면 코드 수정 없이 값만 바꿀 수 있습니다.

파트너스 키가 설정된 서버에서 `DDAKDAMA_EXTENSION_TOKEN`을 비워 두면 딥링크 요청은 기본적으로 거부됩니다. 이는 공개 서버가 타인의 무료 제휴 링크 프록시로 악용되는 것을 막기 위한 안전장치입니다. 로컬 실험에서만 `DDAKDAMA_ALLOW_UNAUTHENTICATED_PARTNERS=true`를 사용할 수 있습니다.

## 서버 실행과 상태 확인

```bash
cd gpt-app
npm install
npm start
```

```bash
curl https://ddakdama.example.com/health
curl \
  -H 'Authorization: Bearer 충분히-긴-무작위-토큰' \
  https://ddakdama.example.com/api/partners/status
```

정상 상태 예:

```json
{
  "ok": true,
  "configured": true,
  "defaultSubId": "ddakdama-main"
}
```

## 딥링크 API 직접 시험

```bash
curl -X POST \
  -H 'Authorization: Bearer 충분히-긴-무작위-토큰' \
  -H 'Content-Type: application/json' \
  -d '{
    "urls": ["https://www.coupang.com/vp/products/123456"],
    "subId": "ddakdama-test"
  }' \
  https://ddakdama.example.com/api/partners/deeplink
```

응답 예:

```json
{
  "ok": true,
  "subId": "ddakdama-test",
  "links": [
    {
      "originalUrl": "https://www.coupang.com/vp/products/123456",
      "affiliateUrl": "https://link.coupang.com/a/example",
      "ok": true,
      "reason": ""
    }
  ],
  "warning": ""
}
```

`affiliateUrl`이 비어 있으면 확장 프로그램은 `originalUrl`로 자동 대체합니다.

## 확장 프로그램 설정

1. 사이드 패널 하단 설정을 엽니다.
2. 서버 주소를 입력합니다.
3. 서버 연결 토큰을 입력합니다.
4. **쿠팡 파트너스 링크 사용**을 켭니다.
5. 고지 확인창을 읽고 동의합니다.
6. Sub ID를 입력합니다.
7. **저장·연결 확인**을 누릅니다.

정상 연결이면 서버 상태와 파트너스 키 설정 여부가 표시됩니다.

## 실제 동작

- **쿠팡 후보 찾기**를 누르면 후보 URL의 딥링크를 미리 생성합니다.
- 후보 카드에 **파트너스 링크** 또는 **일반 링크 대체**가 표시됩니다.
- **파트너스로 담기**를 누르면 딥링크가 있는 상품만 파트너스 URL을 경유합니다.
- 딥링크 리디렉션에 실패하면 직접 상품 URL로 다시 열고 담기를 계속합니다.
- 장바구니 담기와 실제 장바구니 열기는 파트너스 링크 여부와 무관하게 계속됩니다.

## Sub ID 운용 예

```text
ddakdama-main
ddakdama-chatgpt
ddakdama-youtube
ddakdama-user-a
```

Sub ID는 영문, 숫자, `_`, `-`만 남기고 최대 64자로 정규화합니다. 개인식별정보를 넣지 않는 것을 권장합니다.

## 수수료 검증

코드가 딥링크를 생성하고 경유했다고 해서 모든 구매가 자동으로 수수료로 인정되는 것은 아닙니다. 다음은 별도로 확인해야 합니다.

- 계정 승인 상태
- API 사용 권한
- 허용된 홍보 매체
- 클릭·구매 인정 기간
- 자기구매·중복 링크·취소·반품 조건
- 상품 또는 카테고리별 수수료 정책
- 파트너스 대시보드의 클릭·전환 통계

실수수료 검증은 테스트 상품 1개로 링크 생성 → 사용자 클릭 → 정상 장바구니 이동 → 파트너스 대시보드 클릭 반영 순서로 소규모 확인하세요.
