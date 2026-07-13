@echo off
setlocal
cd /d "%~dp0"
where cloudflared >nul 2>nul || (
  echo Cloudflare Tunnel 실행 파일이 없습니다.
  echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ 에서 cloudflared를 설치해 주세요.
  pause
  exit /b 1
)
echo 딱담아 로컬 서버를 공개 HTTPS 주소로 연결합니다.
echo 표시되는 https://...trycloudflare.com 주소 뒤에 /mcp를 붙여 ChatGPT 앱에 등록하세요.
cloudflared tunnel --url http://localhost:8787
pause
