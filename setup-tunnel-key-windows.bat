@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-tunnel-key.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo API key setup failed. Review the error above.
  pause
  exit /b %EXIT_CODE%
)

echo API key setup completed.
pause
exit /b 0
