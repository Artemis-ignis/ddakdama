# 쿠팡 파트너스 연동 설정

## 동작 원칙

딱담아는 서버에 쿠팡 파트너스 키가 설정되어 있으면 Product Search와 Deep Link를 먼저 사용합니다. API 결과가 없거나 호출에 실패하면 일반 쿠팡 브라우저 검색과 직접 상품 URL로 자동 전환합니다.

- Access Key와 Secret Key는 서버에만 저장합니다.
- Chrome 확장 프로그램 번들, ChatGPT 위젯, Git 저장소에는 키를 넣지 않습니다.
- 파트너스 실패 때문에 상품 검색이나 장바구니 작업을 중단하지 않습니다.
- 딥링크 생성은 수수료 발생을 보장하지 않습니다.
- 자동 결제와 주문 확정은 수행하지 않습니다.

## 필요한 계정 상태

- 승인된 쿠팡 파트너스 계정
- 해당 계정에서 API 키를 발급할 수 있는 권한
- 현재 쿠팡 파트너스 공식 포털에 표시되는 Product Search 및 Deep Link 규격

계정이 최종 승인되지 않았거나 API 메뉴가 없다면 일반 쿠팡 검색 fallback만 사용합니다. 판매자용 WING API를 파트너스 API로 대체하지 않습니다.

## 서버 환경변수

`setup-windows.bat`는 처음 실행할 때 `apps/server/.env.example`을 `apps/server/.env`로 복사합니다. 실제 키는 다음 파일에만 입력합니다.

```text
apps/server/.env
```

```dotenv
PORT=8787
PUBLIC_BASE_URL=https://ddakdama.example.com
PAIRING_TTL_SECONDS=600
HANDOFF_TTL_SECONDS=900
DDAKDAMA_STORE_FILE=.data/ddakdama-state.json
COUPANG_PARTNERS_ACCESS_KEY=발급받은_Access_Key
COUPANG_PARTNERS_SECRET_KEY=발급받은_Secret_Key
COUPANG_PARTNERS_SUB_ID=ddakdama-extension
```

`pnpm --filter @ddakdama/server start`와 `start-windows.bat`는 이 파일을 자동으로 읽습니다. `.env`와 `.data` 상태 파일은 Git과 배포 ZIP에서 제외됩니다. 상태 파일에는 원문 비밀키가 아니라 해시된 기기 토큰·연결 grant와 짧은 TTL의 handoff가 저장되어 서버 재시작 뒤에도 연결을 복구합니다.

## 확장 프로그램 서버 주소

일반 사용자 화면에는 서버 주소나 토큰 입력란이 없습니다. 서버 주소는 빌드할 때 주입합니다.

PowerShell 예시:

```powershell
$env:VITE_DDAKDAMA_SERVER_ORIGIN = "https://ddakdama.example.com"
pnpm --filter @ddakdama/extension build
```

로컬 개발 기본값은 `http://localhost:8787`입니다.

## 실제 흐름

1. 사용자가 확장 프로그램에서 `실제 상품 찾기`를 누릅니다.
2. 확장 프로그램은 저장된 device token이 없으면 서버에서 제한된 기기 토큰을 발급받아 로컬 Chrome 저장소에 보관합니다.
3. 서버에 파트너스 키가 있으면 Product Search API를 호출합니다.
4. 파트너스 결과와 브라우저 검색 결과를 복합 SKU 기준으로 합치고 중복을 제거합니다.
5. 장바구니 담기 승인 후 Deep Link API 변환을 시도합니다.
6. 변환 성공 시 딥링크를 경유하고, 실패 시 원래 쿠팡 상품 URL을 사용합니다.
7. 실제 상품 규격·가격·재고·옵션과 장바구니 수량 변화는 동일하게 다시 검증합니다.

GPT 앱 페어링은 쇼핑 목록 handoff용 기능입니다. 파트너스 검색을 사용하기 위해 GPT 앱을 먼저 연결할 필요는 없습니다.

## 보안 통제

- 파트너스 search/deeplink endpoint는 device token을 요구합니다.
- pairing과 affiliate endpoint에는 요청 제한이 적용됩니다.
- 토큰은 SHA-256 해시로 서버 메모리에 보관합니다.
- 연결 해제 시 해당 기기의 token, grant, pairing과 handoff를 함께 폐기합니다.
- 로그에 Secret Key나 원문 토큰을 출력하지 않습니다.

## 사용자 고지

확장 프로그램에는 다음 문구를 계속 표시합니다.

> 쿠팡 파트너스 활동을 통해 일정액의 수수료를 받을 수 있습니다.

Chrome Web Store 공개 빌드는 현재 제휴 링크 정책을 다시 검토해야 합니다. 실제 사용자 혜택이 필요한 정책 상태라면 혜택을 구현하기 전까지 public 빌드에서 제휴 기능을 켜지 않습니다.

## 실제 수수료 검증

다음 항목은 쿠팡 파트너스 대시보드에서 별도로 확인해야 합니다.

- API 키 권한과 호출 성공
- 허용된 홍보 매체
- 클릭 반영
- 구매·취소·반품에 따른 전환 및 정산
- 자기구매 인정 여부
- 상품 또는 카테고리별 수수료율

현재 프로젝트는 키가 없는 상태에서도 일반 쿠팡 검색과 장바구니 흐름이 계속 작동하도록 설계되어 있습니다.
