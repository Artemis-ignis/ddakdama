@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-openai-tunnel.ps1"
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo OpenAI Secure MCP Tunnel을 시작하지 못했습니다. 위 오류를 확인해 주세요.
pause
exit /b 1
