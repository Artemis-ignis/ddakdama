# Chrome 확장 프로그램 설정

소스에서 로드할 폴더는 `apps\extension` 하나입니다. 이 폴더에는 `manifest.json`과 빌드된 `dist`가 함께 있어야 합니다. `dist` 자체를 선택하면 매니페스트 오류가 발생합니다. 공개 베타 배포본은 `apps\extension\release\ddakdama-extension-v1.0.3.zip`이며, 압축을 푼 뒤 `manifest.json`이 바로 보이는 최상위 폴더를 선택합니다.

정상 화면에는 딱담아 로고, 확장 프로그램 v1.0.3, 4단계 진행 표시, `GPT·웹에서 만든 계획 바로 이어하기`, 목록 입력과 상품 확인 버튼이 보입니다. `6자리 코드`는 예전 ChatGPT 앱 연결을 계속 써야 할 때만 펼쳐서 사용합니다. 흰 화면이거나 새 연결이 보이지 않으면 `pnpm build` 후 Chrome 확장 프로그램 카드에서 새로고침하고 사이드 패널을 닫았다 다시 여십시오.

일반 사용자 화면에는 서버 주소, MCP URL, 토큰, API 키와 개발 로그가 표시되지 않습니다.

기본 흐름은 코드 입력이 아닙니다. GPTs 또는 딱담아 웹에서 목록과 상품을 확정한 뒤 `Chrome 확장프로그램에서 계속하기`를 누르면 확장프로그램 사이드 패널이 같은 계획을 자동으로 엽니다. 확장프로그램이 없으면 웹에서 설치 안내를 표시하고, 설치 뒤에는 같은 버튼을 한 번 더 누르면 됩니다. 로컬 개발 서버는 `launch-windows.bat`으로 함께 실행할 수 있습니다.

자동 검증은 `pnpm test:extension`과 `pnpm test:preview`를 사용합니다. 전자는 공식 Playwright 번들 Chromium에 실제 확장을 로드하고, 후자는 동일한 Side Panel React 컴포넌트를 일반 HTTP에서 시각 검증합니다.
