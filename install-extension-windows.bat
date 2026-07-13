@echo off
setlocal
cd /d "%~dp0"
if not exist "apps\extension\manifest.json" goto :missing
if not exist "apps\extension\dist\index.html" call pnpm build
echo Chrome에서 아래 폴더 하나를 압축해제된 확장 프로그램으로 불러오세요.
echo %~dp0apps\extension
start "" chrome://extensions/
pause
exit /b 0
:missing
echo apps\extension\manifest.json을 찾지 못했습니다.
pause
exit /b 1
