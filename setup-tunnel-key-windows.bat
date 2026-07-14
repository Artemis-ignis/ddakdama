@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-tunnel-key.ps1"
if errorlevel 1 goto :fail
echo.
echo 터널 전용 API 키 설정이 완료되었습니다.
pause
exit /b 0

:fail
echo.
echo API 키 설정에 실패했습니다. 위 오류를 확인해 주세요.
pause
exit /b 1
