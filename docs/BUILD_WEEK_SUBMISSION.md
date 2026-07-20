# OpenAI Build Week 제출 가이드

## 제출 상태

- Devpost 프로젝트: `DdakDama` (`published`, OpenAI Build Week 제출 연결 완료)
- 참가 등록: 완료
- 권장 트랙: **Apps for Your Life**
- 제출 마감: 2026-07-22 09:00 KST (2026-07-21 17:00 PT)
- 데모 영상: [YouTube 공개 링크](https://youtu.be/Lpdt90FKWVA) 연결 완료 — 2분 52초, 음성·영문 자막 포함
- 제출 전 최종 확인: `/feedback` Codex Session ID 값과 저장소 접근 권한(비공개일 경우 심사자 2인 공유)

## App info

**Name**

DdakDama

**Elevator pitch**

Turn any shopping list into a verified cart in one click.

**Category**

Apps for Your Life

**Short category description**

DdakDama is an AI commerce and consumer productivity app that turns natural-language shopping lists into structured product plans, accurately identifying product names, sizes, specifications, and quantities. Through its ChatGPT app and Chrome extension, it matches live Coupang listings, compares prices and delivery options, and lets users review and add verified products to their cart in one streamlined flow.

## Full Devpost description

### Inspiration

AI can recommend a complete shopping routine in seconds, but acting on that recommendation is still painfully manual. Users must search every product again, distinguish 100 mg from 240 tablets, work out whether “two items” means two single units or one two-pack, compare near-identical listings, and then verify the cart one more time. DdakDama removes that gap between a useful shopping list and a trustworthy cart.

### What it does

DdakDama turns a free-form, multi-line shopping list into an editable plan with product names, unit sizes, strengths, package contents, and requested physical quantities. Its ChatGPT app lets the user review the interpretation, while the paired Chrome extension searches Coupang, shows matching candidates with prices and delivery information, and calculates an estimated total.

Before adding anything, DdakDama performs a preflight check for product identity, exact size, package count, live detail-page price, stock, required options, and the quantity that must be added to the cart. It never treats a button click as success: after each add, it checks the cart by product or vendor identifier and verifies the quantity delta. Partial failures remain visible, and payment is always completed manually by the user on Coupang.

### How we built it

The project is a TypeScript monorepo with four main layers:

- A deterministic parser and quantity planner shared by every surface.
- A Manifest V3 Chrome Side Panel extension that searches, compares, validates, and adds approved Coupang products.
- An OpenAI Apps SDK / MCP ChatGPT app that renders the review widget and securely hands plans to a paired extension.
- A Cloudflare Worker and Durable Object service that provides a stable public MCP endpoint, short-lived pairing codes, device-scoped grants, idempotent handoffs, rate limiting, and multi-user isolation.

GPT-5.6 is used to understand the user's shopping intent and invoke the correct structured tools. Codex accelerated repository analysis, architecture changes, parser and browser-state-machine implementation, visual iteration, security hardening, and the creation and execution of regression tests across the extension, MCP server, and public Worker.

### Challenges we ran into

Shopping quantities are deceptively difficult. “50 mL 2개” requests two physical units, while “100 mg 240정” describes one bottle containing 240 tablets. Coupang listings add another layer: a requested pair might be satisfied by two singles or one two-pack, prices can render later than the product shell, and similar titles can point to different SKUs.

We addressed this with typed unit classification, exact and explainable quantity plans, strict automatic matching, manual candidate recovery for fuzzy or misspelled input, detail-page price verification, and cart-delta checks keyed by stable identifiers. We also made extension jobs journaled and idempotent so a service-worker restart cannot silently add the same item twice.

### Accomplishments that we're proud of

- Correctly parses the fixed five-line test list as five product types and seven physical units.
- Separates 100 mg strength from a 240-tablet package and treats it as one bottle.
- Supports exact single-unit and multi-pack plans without hiding over-purchase.
- Preserves partial failures instead of showing a false success state.
- Verifies the actual cart quantity change after each add.
- Provides a public, multi-user MCP service with isolated pairing and handoff data.
- Supports both light and dark ChatGPT themes and keeps developer credentials out of consumer UI.
- Never automates payment or order confirmation.

### What we learned

The hardest part of an agentic shopping flow is not generating a recommendation; it is building a transparent verification boundary between probabilistic language understanding and a real commercial action. We learned to keep natural-language interpretation flexible while making product identity, quantity, price, and cart mutation deterministic and observable.

### What's next for DdakDama

Next, we plan to publish the extension through the Chrome Web Store, expand the store-adapter interface beyond Coupang, add price-history and substitution preferences, and introduce an opt-in affiliate benefit model that is transparent to users and compliant with each platform's rules.

## Built with

- GPT-5.6
- Codex
- OpenAI Apps SDK
- Model Context Protocol (MCP)
- TypeScript
- React
- Chrome Extensions / Manifest V3
- Cloudflare Workers
- Cloudflare Durable Objects
- Zod
- Playwright
- Vitest
- Coupang

## 심사자 설치·테스트 안내

1. ChatGPT 개발자 모드에서 `https://ddakdama.ddakdama.workers.dev/mcp`를 앱 서버로 연결합니다.
2. `pnpm install`, `pnpm test:e2e`, `pnpm build`를 실행한 뒤 Chrome의 `chrome://extensions`에서 개발자 모드를 켜고 `apps/extension`을 압축 해제된 확장 프로그램으로 불러옵니다.
3. 확장 프로그램의 `GPT 앱 연결`에서 일회용 6자리 코드를 발급합니다.
4. ChatGPT의 DdakDama 위젯에 코드를 입력해 한 번 연결합니다.
5. 아래 고정 목록을 ChatGPT에 입력합니다.

       닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml
       스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개
       라운드랩 1025 독도 클렌저 150ml 2개
       TS 골드플러스 샴푸 500g
       닥터스베스트 고흡수 마그네슘 100mg 240정

6. ChatGPT 위젯에서 5종·실물 7개와 마그네슘 100 mg / 240정을 확인하고 확장 프로그램으로 전송합니다.
7. 확장 프로그램에서 후보, 상세 확인가, 예상 합계와 preflight 결과를 확인합니다.
8. 실제 장바구니 변경은 심사자가 명시적으로 승인했을 때만 실행합니다. 결제는 자동화되지 않습니다.

## 3분 데모 영상 구성

### 0:00–0:20 — Problem

“AI can recommend a complete shopping routine, but users still have to search every item, decode package sizes, compare similar listings, and rebuild the cart manually. DdakDama turns that recommendation into a verified, reviewable cart flow.”

### 0:20–0:55 — GPT-5.6 parsing

- ChatGPT에 고정 5종 목록 입력
- 5종·실물 7개 표시
- `100mg`은 함량, `240정`은 포장 규격, 요청 수량은 1병임을 강조

Voiceover: “GPT-5.6 interprets the user's intent and calls DdakDama's structured MCP tools. The shared parser keeps quantities deterministic across ChatGPT and the browser extension.”

### 0:55–1:25 — Pairing and handoff

- 확장 프로그램에서 6자리 코드 발급
- ChatGPT 위젯에서 연결
- 목록 전송 및 확장 프로그램 수신 확인

Voiceover: “The app uses a short-lived pairing code and a device-scoped grant. Plans are idempotent, expire automatically, and are isolated per user.”

### 1:25–2:15 — Product comparison and preflight

- 후보 가격·배송·묶음 비교
- 단품 2개와 2개 묶음 1세트의 실물 수량 설명
- 일치하지 않는 후보는 직접 선택하거나 검색어 수정
- 상세가격·재고·옵션·수량 사전검사

Voiceover: “The extension does not trust the first search result. It checks identity, size, strength, package count, live price, stock, options, and exact physical quantity before enabling an add.”

### 2:15–2:40 — Cart verification and safe failure

- fixture 또는 승인된 라이브 테스트로 수량 delta 성공 표시
- 일부 실패 시 성공으로 위장하지 않는 화면
- 실제 담긴 금액 합계와 새 목록 시작 버튼

Voiceover: “A click is not success. DdakDama verifies the cart delta using stable product identifiers, resumes safely after service-worker restarts, and shows partial failures explicitly.”

### 2:40–3:00 — Codex and closing

Voiceover: “Codex helped us redesign the architecture, implement the parser and cart state machine, harden the public MCP service, and build 58 unit and integration tests plus 28 browser tests. DdakDama closes the gap between an AI recommendation and a cart users can trust.”

## 제출 필수 필드

- Submitter Type: `Individual` (마스터가 개인 출품할 경우)
- Country of Residence: `Korea Republic of`
- Category: `Apps for Your Life`
- Code repository: `https://github.com/Artemis-ignis/ddakdama`
- Test URL: `https://ddakdama.ddakdama.workers.dev/mcp`
- `/feedback` Session ID: **마스터 입력 필요**
- Demo video URL: `https://youtu.be/Lpdt90FKWVA` (2분 52초, 공개 링크 접근 확인)
- Plugin installation/testing instructions: 위 “심사자 설치·테스트 안내” 사용

## 제출 전 체크리스트

- [x] Devpost 참가 등록
- [x] DdakDama 프로젝트 초안 생성
- [x] 공개 MCP 및 웹 페이지 배포
- [x] 공개 MCP 5종·7개 페어링/전송/ACK/연결 해제 검증
- [x] 서로 다른 두 사용자 데이터 격리 검증
- [x] lint, typecheck, unit/integration, E2E, build 통과
- [x] 최신 코드 GitHub `main` 반영 확인 — v1.0.2 검색 복구·데모 제작 파이프라인 포함
- [ ] 비공개 저장소를 `testing@devpost.com`, `build-week-event@openai.com`에 공유
- [ ] `/feedback` Codex Session ID 입력
- [x] 공개 YouTube 데모 영상 연결 및 링크 접근 확인
- [ ] Devpost 썸네일 업로드
- [ ] 최종 제출 전 마스터 승인

## 해커톤 기간에 새로 확장한 부분

2026-07-13 이후 작업은 Git 커밋과 Codex 작업 기록으로 확인할 수 있습니다. 주요 확장은 공개 Cloudflare Worker/Durable Object 다중 사용자 서비스, GPT 앱과 확장 프로그램의 일회성 페어링 및 영구 연결, 후보 직접 선택과 오타 복구, 지연 가격 렌더링과 실제 SKU 검증, 장바구니 delta 및 재시작 중복 방지, 실제 담긴 가격 합계, 새 목록 시작 흐름, 다크모드 ChatGPT 위젯입니다.
