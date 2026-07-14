@echo off
setlocal
cd /d "%~dp0"
call pnpm package
if errorlevel 1 goto :fail
echo Packaging completed.
pause
exit /b 0

:fail
echo Packaging failed. Review the error above.
pause
exit /b 1
