# 딱담아 v2 아키텍처

딱담아는 하나의 `CartPlan`과 불변 `CartExecution`을 공유하는 세 표면으로 구성된다.

| 표면 | 단독 사용 | 공통 백엔드 연동 |
| --- | --- | --- |
| Android 앱 | 목록 검토와 fixture 실행 | App Link로 execution claim 및 상태 보고 |
| ChatGPT 앱 | 대화로 목록 작성과 Android·extension 전달 | Worker MCP와 공통 계획 계약 사용 |
| Chrome 확장프로그램 | 직접 목록 입력·상품 검색·장바구니 실행 | 파트너스 검색·딥링크 API 사용 |
| 웹 | GPT 없이 목록을 만들고 후보를 선택 | `/api/plans` 계약 및 Android execution App Link 생성 |

`CartPlan`은 편집 가능한 후보와 선택값을 보관한다. `CartExecution`은 특정 plan version을 복사해 실행 중 원본이 바뀌어도 달라지지 않는다. 익명 사용자는 plan access token으로 자신의 계획에 접근하며, 계정 동기화는 이후 OAuth 계층으로 추가한다.

웹의 Android 실행 버튼은 사용자가 명시적으로 누를 때만 `CartExecution`과 단기 claim link를 만든다. 앱이 설치되어 있으면 해당 execution을 claim하고, 앱이 없으면 웹은 계획을 보존한 채 재시도 안내만 제공한다.

ChatGPT 위젯의 Android 계속하기는 아직 후보를 고르지 않은 `CartPlan`을 전달한다. `create_mobile_plan_link`는 계획 access token을 URL에 넣지 않고, 짧은 수명의 단일 claim token만 포함한 `ddakdama://plan/{planId}?claim=...` 링크를 만든다. Android는 자신의 설치 토큰으로 claim한 뒤 별도 capability를 발급받고, 후보 검색·검토로 이어간다. 파트너스 API가 없으면 일반 쿠팡 검색 fallback임을 화면에 표시한다.

배송 정보는 `CONFIRMED`, `CONDITIONAL`, `UNKNOWN`으로 구분한다. 주소·와우 멤버십·쿠폰·장바구니 묶음이 필요한 값은 서버 검색 결과로 확정했다고 표시하지 않는다.
