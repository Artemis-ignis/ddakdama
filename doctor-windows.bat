@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

node --version
if errorlevel 1 goto :fail
call pnpm --version
if errorlevel 1 goto :fail
call pnpm lint
if errorlevel 1 goto :fail
call pnpm test
if errorlevel 1 goto :fail
call pnpm typecheck
if errorlevel 1 goto :fail
call pnpm test:e2e
if errorlevel 1 goto :fail
call pnpm build
if errorlevel 1 goto :fail

echo 모든 코드 진단이 통과했습니다.
echo 터널 연결 진단은 서버 실행 후 tunnel-windows.bat에서 자동 수행됩니다.
pause
exit /b 0

:fail
echo 진단에 실패했습니다. 위 오류를 확인해 주세요.
pause
exit /b 1
