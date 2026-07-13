@echo off
setlocal
cd /d "%~dp0"
start "딱담아 서버" cmd /k call "%~dp0start-windows.bat"
timeout /t 2 /nobreak >nul
start "딱담아 HTTPS 터널" cmd /k call "%~dp0tunnel-windows.bat"
echo 서버와 개발용 HTTPS 터널을 시작했습니다.
pause
