@echo off
setlocal
cd /d "%~dp0"
if not exist "apps\extension\manifest.json" goto :missing
call pnpm --filter @ddakdama/extension build
if errorlevel 1 goto :fail
if not exist "apps\extension\manifest.json" goto :missing
if not exist "apps\extension\dist\index.html" goto :incomplete
if not exist "apps\extension\dist\background.js" goto :incomplete
if not exist "apps\extension\dist\content.js" goto :incomplete

:ready
echo.
echo [IMPORTANT] Select this folder in Chrome:
echo %~dp0apps\extension
echo.
echo Do not select the dist folder. It does not contain manifest.json.
start "" chrome://extensions/
pause
exit /b 0

:missing
echo apps\extension\manifest.json was not found.
pause
exit /b 1

:fail
echo Extension build failed. Review the error above.
pause
exit /b 1

:incomplete
echo The extension build is incomplete. Check manifest.json and dist output.
pause
exit /b 1
