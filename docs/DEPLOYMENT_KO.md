# 배포 안내

## 개인 개발 모드

`start-windows.bat`으로 로컬 서버를 실행하고 `tunnel-windows.bat`으로 OpenAI Secure MCP Tunnel을 시작합니다. 로컬 MCP 서버를 공개 인터넷에 노출하지 않으며, ChatGPT 앱에는 고정된 Platform 터널을 연결합니다.

- 터널 ID: `tunnel_6a558b1cfec48191993a91062fa9f5e3`
- 로컬 MCP: `http://127.0.0.1:8787/mcp`
- 런타임 키 권한: Tunnels `Read + Use`
- 런타임 키 저장: Windows DPAPI, `%LOCALAPPDATA%\DdakDama\secrets`
- 브라우저 자동 열기: 사용하지 않음

## 운영 모드

- `/mcp` 스트리밍을 지원하는 고정 HTTPS 도메인을 사용합니다.
- 운영 확장 프로그램을 빌드할 때 서버 원본을 `VITE_DDAKDAMA_SERVER_ORIGIN=https://your-domain.example`로 지정한 뒤 `pnpm package`를 실행합니다. 이 값은 공개 주소이며 비밀키가 아닙니다.
- 서버 원본을 지정하지 않은 Web Store ZIP은 localhost 권한을 제거하며 GPT 앱 연결을 비활성 상태로 유지합니다. 일반 쿠팡 검색·검토 흐름은 사용할 수 있습니다.
- 파트너스 비밀키는 호스팅 Secret Manager에 저장합니다.
- CORS 허용 origin, rate limit, 영속 TTL 저장소와 모니터링을 운영 환경에 맞게 제한합니다.
- 공개 Chrome Web Store 빌드는 실제 사용자 혜택이 없는 한 제휴 기능을 비활성화합니다.
- ChatGPT 앱과 Chrome Web Store 공개 제출은 별도 사용자 승인 후 진행합니다.

공식 안내: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
