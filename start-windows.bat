@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist "apps\server\dist\index.js" call pnpm build
if errorlevel 1 goto :fail
echo 딱담아 서버를 시작합니다. 이 창을 닫으면 서버도 종료됩니다.
call pnpm --filter @ddakdama/server start
if errorlevel 1 goto :fail
pause
exit /b 0
:fail
echo 딱담아 서버를 시작하지 못했습니다. 위 오류를 확인해 주세요.
pause
exit /b 1
