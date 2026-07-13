@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "CLOUDFLARED=cloudflared"
if exist ".tools\cloudflared.exe" set "CLOUDFLARED=.tools\cloudflared.exe"
where %CLOUDFLARED% >nul 2>nul || (
  echo Cloudflare Tunnel 실행 파일이 없습니다.
  echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ 에서 cloudflared를 설치해 주세요.
  pause
  exit /b 1
)
echo 딱담아 로컬 서버를 공개 HTTPS 주소로 연결합니다.
echo 표시되는 https://...trycloudflare.com 주소 뒤에 /mcp를 붙여 ChatGPT 앱에 등록하세요.
%CLOUDFLARED% tunnel --url http://localhost:8787 --no-autoupdate
if errorlevel 1 goto :fail
pause
exit /b 0
:fail
echo HTTPS 터널 실행에 실패했습니다.
pause
exit /b 1
