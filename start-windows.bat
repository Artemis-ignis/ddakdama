@echo off
setlocal
cd /d "%~dp0"
if not exist "apps\server\dist\index.js" call pnpm build
echo 딱담아 서버를 시작합니다. 이 창을 닫으면 서버도 종료됩니다.
call pnpm --filter @ddakdama/server start
pause
