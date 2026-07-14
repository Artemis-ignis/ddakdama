@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-openai-tunnel.ps1"
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo OpenAI Secure MCP Tunnel failed to start. Review the error above.
pause
exit /b 1
