@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
call pnpm package
if errorlevel 1 goto :fail
echo 패키징을 완료했습니다.
pause
exit /b 0
:fail
echo 패키징에 실패했습니다. 위 오류를 확인해 주세요.
pause
exit /b 1
