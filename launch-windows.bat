@echo off
setlocal
cd /d "%~dp0"

start "DdakDama server" cmd.exe /d /k call "%~dp0start-windows.bat"
powershell.exe -NoLogo -NoProfile -Command "$ok=$false; 1..30 | ForEach-Object { try { if((Invoke-RestMethod http://127.0.0.1:8787/health -TimeoutSec 2).ok){$ok=$true;break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){exit 1}"
if errorlevel 1 goto :fail

start "DdakDama OpenAI tunnel" cmd.exe /d /k call "%~dp0tunnel-windows.bat"
echo DdakDama server and OpenAI Secure MCP Tunnel started.
echo No browser tab is opened automatically.
pause
exit /b 0

:fail
echo Server health check failed. The tunnel was not started.
pause
exit /b 1
