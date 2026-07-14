@echo off
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

echo All code checks passed.
echo Tunnel diagnostics run automatically from tunnel-windows.bat.
pause
exit /b 0

:fail
echo Diagnostics failed. Review the error above.
pause
exit /b 1
