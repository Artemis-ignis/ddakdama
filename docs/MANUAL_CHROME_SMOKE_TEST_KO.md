# 실제 Google Chrome 수동 확인

Playwright 번들 Chromium 자동 검증과 별도로 실제 사용자 Chrome 설치 화면은 다음 한 번만 확인합니다.

1. `chrome://extensions`를 엽니다.
2. 개발자 모드를 켭니다.
3. **압축해제된 확장 프로그램을 로드**합니다.
4. `C:\Users\50106\Desktop\딱담아\apps\extension` 폴더를 선택합니다. `dist` 폴더가 아닙니다.
5. 딱담아 카드에 오류가 없는지 확인합니다.
6. 딱담아 아이콘을 눌러 Side Panel을 엽니다.
7. `상품 5종 · 실물 7개`, `실제 상품 찾기`, `GPT 앱과 이어서 담기`가 보이는지 확인합니다.

내부 Chrome 페이지는 자동화 도구의 URL 정책상 직접 제어하지 않습니다. 이 수동 확인과 Playwright Chromium 자동 E2E를 함께 증거로 사용합니다.
