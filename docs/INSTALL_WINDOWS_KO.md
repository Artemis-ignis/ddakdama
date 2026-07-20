# Windows 설치

1. Node.js LTS를 설치합니다.
2. 프로젝트 루트의 `setup-windows.bat`을 더블클릭합니다.
3. 설치·테스트·빌드가 끝나면 `start-windows.bat`을 실행합니다.
4. Chrome `chrome://extensions`에서 개발자 모드를 켭니다.
5. **압축해제된 확장 프로그램을 로드**하고 `apps\extension` 폴더 하나를 선택합니다.
6. 코드가 바뀌면 확장 프로그램 카드의 **업데이트**를 누르고 사이드 패널을 다시 엽니다.

사용자가 선택할 매니페스트는 `apps\extension\manifest.json` 하나입니다. `apps\extension\dist`는 `background.js`, `content.js`, `index.html`만 담는 빌드 폴더이므로 따로 선택하지 않습니다. 배포 ZIP을 받았다면 `ddakdama-extension-v1.0.2.zip`을 압축 해제하고, 그 안에서 `manifest.json`이 바로 보이는 최상위 폴더를 선택합니다.
