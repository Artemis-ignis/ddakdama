# 배포 안내

## 개인 개발 모드

`start-windows.bat`으로 로컬 서버를 실행하고 `tunnel-windows.bat`으로 HTTPS 터널을 엽니다. Quick Tunnel 주소는 재실행 때 바뀔 수 있습니다.

## 운영 모드

- `/mcp` 스트리밍을 지원하는 고정 HTTPS 도메인을 사용합니다.
- 파트너스 비밀키는 호스팅 Secret Manager에 저장합니다.
- CORS 허용 origin, rate limit, 영속 TTL 저장소와 모니터링을 운영 환경에 맞게 제한합니다.
- 공개 Chrome Web Store 빌드는 실제 사용자 혜택이 없는 한 제휴 기능을 비활성화합니다.
- ChatGPT 앱과 Chrome Web Store 공개 제출은 별도 사용자 승인 후 진행합니다.
