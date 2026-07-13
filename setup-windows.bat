@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo [딱담아] 설치를 준비합니다.
where node >nul 2>nul || (echo Node.js LTS를 먼저 설치해 주세요.& pause & exit /b 1)
where pnpm >nul 2>nul || (echo pnpm을 설치합니다.& call npm install -g pnpm)
if not exist "apps\server\.env" (
  copy /y "apps\server\.env.example" "apps\server\.env" >nul
  echo 서버 설정 파일 apps\server\.env 을 만들었습니다.
)
call pnpm install
if errorlevel 1 goto :fail
call pnpm exec playwright install chromium
if errorlevel 1 goto :fail
call pnpm lint
if errorlevel 1 goto :fail
call pnpm typecheck
if errorlevel 1 goto :fail
call pnpm test
if errorlevel 1 goto :fail
call pnpm test:e2e
if errorlevel 1 goto :fail
call pnpm build
if errorlevel 1 goto :fail
echo 설치와 검증이 끝났습니다.
pause
exit /b 0
:fail
echo 설치 중 문제가 발생했습니다. 위 오류를 확인해 주세요.
pause
exit /b 1
