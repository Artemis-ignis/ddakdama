@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
start "딱담아 서버" cmd /k call "%~dp0start-windows.bat"
powershell -NoProfile -Command "$ok=$false; 1..15 | ForEach-Object { try { if((Invoke-RestMethod http://localhost:8787/health -TimeoutSec 2).ok){$ok=$true;break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){exit 1}"
if errorlevel 1 goto :fail
start "딱담아 HTTPS 터널" cmd /k call "%~dp0tunnel-windows.bat"
echo 서버와 개발용 HTTPS 터널을 시작했습니다.
pause
exit /b 0
:fail
echo 서버 health 확인에 실패해 터널을 시작하지 않았습니다.
pause
exit /b 1
