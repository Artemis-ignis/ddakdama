@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo 최신 소스로 딱담아 서버를 빌드합니다.
call pnpm --filter @ddakdama/server build
if errorlevel 1 goto :fail

for /f "tokens=*" %%P in ('powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){try{$h=Invoke-RestMethod http://127.0.0.1:8787/health -TimeoutSec 2}catch{}; if($h.name -eq 'ddakdama'){$c.OwningProcess}}"') do set "DDAKDAMA_OLD_PID=%%P"
if defined DDAKDAMA_OLD_PID (
  echo 이전 딱담아 서버를 종료하고 최신 빌드로 교체합니다.
  powershell -NoProfile -Command "Stop-Process -Id %DDAKDAMA_OLD_PID% -Force"
  timeout /t 1 /nobreak >nul
)

echo 딱담아 서버를 시작합니다. 이 창을 닫으면 서버가 종료됩니다.
call pnpm --filter @ddakdama/server start
if errorlevel 1 goto :fail
exit /b 0

:fail
echo 딱담아 서버를 시작하지 못했습니다. 위 오류를 확인해 주세요.
pause
exit /b 1
