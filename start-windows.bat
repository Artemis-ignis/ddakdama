@echo off
setlocal
cd /d "%~dp0"

echo Building the DdakDama server from current sources.
call pnpm --filter @ddakdama/server build
if errorlevel 1 goto :fail

for /f "tokens=*" %%P in ('powershell.exe -NoLogo -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){try{$h=Invoke-RestMethod http://127.0.0.1:8787/health -TimeoutSec 2}catch{}; if($h.name -eq 'ddakdama'){$c.OwningProcess}}"') do set "DDAKDAMA_OLD_PID=%%P"
if defined DDAKDAMA_OLD_PID (
  echo Replacing the previous DdakDama server process.
  powershell.exe -NoLogo -NoProfile -Command "Stop-Process -Id %DDAKDAMA_OLD_PID% -Force"
  timeout /t 1 /nobreak >nul
)

echo Starting DdakDama server. Closing this window stops the server.
call pnpm --filter @ddakdama/server start
if errorlevel 1 goto :fail
exit /b 0

:fail
echo DdakDama server failed to start. Review the error above.
pause
exit /b 1
