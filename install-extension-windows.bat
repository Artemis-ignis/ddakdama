@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist "apps\extension\manifest.json" goto :missing
if not exist "apps\extension\dist\index.html" call pnpm build
if errorlevel 1 goto :fail
echo Chrome에서 아래 폴더 하나를 압축해제된 확장 프로그램으로 불러오세요.
echo %~dp0apps\extension
start "" chrome://extensions/
pause
exit /b 0
:missing
echo apps\extension\manifest.json을 찾지 못했습니다.
pause
exit /b 1
:fail
echo 확장 프로그램 빌드에 실패했습니다. 위 오류를 확인해 주세요.
pause
exit /b 1
