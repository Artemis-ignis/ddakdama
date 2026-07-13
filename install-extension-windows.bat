@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist "apps\extension\manifest.json" goto :missing
if not exist "apps\extension\dist\index.html" goto :build
if not exist "apps\extension\dist\background.js" goto :build
if not exist "apps\extension\dist\content.js" goto :build
goto :ready
:build
call pnpm build
if errorlevel 1 goto :fail
if not exist "apps\extension\manifest.json" goto :missing
if not exist "apps\extension\dist\index.html" goto :incomplete
if not exist "apps\extension\dist\background.js" goto :incomplete
if not exist "apps\extension\dist\content.js" goto :incomplete
:ready
echo.
echo [중요] Chrome에서 아래 폴더 하나만 선택하세요.
echo %~dp0apps\extension
echo.
echo dist 폴더를 선택하면 매니페스트 오류가 발생합니다.
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
:incomplete
echo 빌드 후에도 manifest.json, index.html, background.js 또는 content.js가 없습니다.
pause
exit /b 1
