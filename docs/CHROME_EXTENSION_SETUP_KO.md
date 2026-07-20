# Chrome 확장 프로그램 설정

소스에서 로드할 폴더는 `apps\extension` 하나입니다. 이 폴더에는 `manifest.json`과 빌드된 `dist`가 함께 있어야 합니다. `dist` 자체를 선택하면 매니페스트 오류가 발생합니다. 배포본은 `dist/ddakdama-extension-v1.0.2.zip` 하나만 사용하고, 압축 해제 후 `manifest.json`이 바로 보이는 최상위 폴더를 선택합니다.

정상 화면에는 딱담아 로고, 4단계 진행 표시, `상품 5종 · 실물 7개`, GPT 앱 연결, 목록 입력과 상품 검색 버튼이 보입니다. 흰 화면이면 `pnpm build` 후 Chrome 확장 프로그램 카드에서 업데이트하고 사이드 패널을 닫았다 다시 여십시오.

일반 사용자 화면에는 서버 주소, MCP URL, 토큰, API 키와 개발 로그가 표시되지 않습니다.

GPT 앱은 확장 프로그램의 `연결하기`를 한 번 누르면 표시되는 6자리 숫자로 연결합니다. 연결 뒤에는 ChatGPT에서 목록을 보낸 다음 `목록 받기`만 누르면 됩니다. 로컬 개발 서버는 `launch-windows.bat`으로 함께 실행할 수 있습니다.

자동 검증은 `pnpm test:extension`과 `pnpm test:preview`를 사용합니다. 전자는 공식 Playwright 번들 Chromium에 실제 확장을 로드하고, 후자는 동일한 Side Panel React 컴포넌트를 일반 HTTP에서 시각 검증합니다.
