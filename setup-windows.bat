@echo off
setlocal
cd /d "%~dp0"

echo Preparing the DdakDama development environment.
where node >nul 2>nul || (
  echo Install Node.js LTS first.
  pause
  exit /b 1
)
where pnpm >nul 2>nul || (
  echo Installing pnpm.
  call npm install -g pnpm
  if errorlevel 1 goto :fail
)

if not exist "apps\server\.env" (
  copy /y "apps\server\.env.example" "apps\server\.env" >nul
  echo Created apps\server\.env from the example file.
)

call pnpm install
if errorlevel 1 goto :fail
call pnpm exec playwright install chromium
if errorlevel 1 goto :fail
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-openai-tunnel-client.ps1"
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

echo Setup and baseline verification completed.
pause
exit /b 0

:fail
echo Setup failed. Review the error above.
pause
exit /b 1
