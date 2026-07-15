@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required.
  pause
  exit /b 1
)
node scripts\support-inbox.mjs %*
set "DDAKDAMA_EXIT=%ERRORLEVEL%"
if not "%DDAKDAMA_EXIT%"=="0" pause
exit /b %DDAKDAMA_EXIT%
