@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\resume-public-release.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo Public release did not complete. Review the error above.
  pause
  exit /b %EXIT_CODE%
)

echo Public release completed successfully.
pause
exit /b 0
