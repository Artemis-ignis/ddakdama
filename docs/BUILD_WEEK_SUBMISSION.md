# OpenAI Build Week 제출 가이드

## 제출 상태

- Devpost 프로젝트: `DdakDama` (`published`, OpenAI Build Week 제출 연결 완료)
- 참가 등록: 완료
- 권장 트랙: **Apps for Your Life**
- 제출 마감: 2026-07-22 09:00 KST (2026-07-21 17:00 PT)
- 데모 영상: [YouTube 공개 링크](https://youtu.be/hpRkAGgw03c) 연결 완료 — 51초, 음성·내장 영문 자막 포함
- 제출 상태: Devpost `Submitted`; 공개 저장소·현재 영상·`/feedback` Session ID 반영 완료. 세션 ID 원문은 공개 저장소에 기록하지 않음.

## App info

**Name**

DdakDama

**Elevator pitch**

Turn a shopping list into a verified, reviewable Coupang cart.

**Category**

Apps for Your Life

**Short category description**

DdakDama is an AI commerce and consumer productivity app that turns natural-language shopping lists into structured product plans, accurately identifying product names, sizes, specifications, and quantities. Through its ChatGPT app and Chrome extension, it searches Coupang, preserves real candidates for review, and lets users add only approved, verified products to their cart.

## Full Devpost description

### Inspiration

AI can recommend a complete shopping routine in seconds, but acting on that recommendation is still painfully manual. Users must search every product again, distinguish 100 mg from 240 tablets, work out whether “two items” means two single units or one two-pack, compare near-identical listings, and then verify the cart one more time. DdakDama removes that gap between a useful shopping list and a trustworthy cart.

### What it does

DdakDama turns a free-form, multi-line shopping list into an editable plan with product names, unit sizes, strengths, package contents, and requested physical quantities. Its ChatGPT app lets the user review the interpretation, while the paired Chrome extension searches Coupang and keeps every real candidate visible for comparison.

The v1.0.2 flow separates search from automatic selection: it searches the full request, then product identity, then a core-product fallback without ever reducing a query to only a size or quantity. Exact product, size, and package matches are `EXACT` and may be selected automatically; non-exact but real results are `REVIEW` and remain available for user confirmation. Only a genuine zero-result search is `NONE`.

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

- Preserves product identity from ChatGPT through the paired extension and covers the fixed 10-item summer-snack regression list.
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

## 현재 데모 영상 구성 (51초)

현재 제출 영상은 [YouTube](https://youtu.be/hpRkAGgw03c)의 51초 v1.0.2 데모입니다. 실제 빌드된 위젯·확장 UI를 fixture 기반 상점 데이터와 함께 재현하며, 실제 결제·주문 자동화는 포함하지 않습니다.

- **0:00–0:08** — 자연어 쇼핑 목록을 검토 가능한 카트 계획으로 변환
- **0:08–0:18** — GPT-5.6이 제품명·규격·포장·실물 수량을 해석하고 `100mg`과 `240정`을 구분
- **0:18–0:30** — ChatGPT 앱에서 페어링된 Chrome 확장 프로그램으로 계획 전달 및 쿠팡 후보 검색
- **0:30–0:42** — `EXACT` 자동 선택과 `REVIEW` 후보 보존, 재검색·제외·직접 선택 경로
- **0:42–0:51** — 가격·재고·옵션·수량과 장바구니 수량 delta 검증, Codex가 가속한 구현·회귀 테스트, 결제는 사용자에게 유지

## 제출 필수 필드

- Submitter Type: `Individual` (마스터가 개인 출품할 경우)
- Country of Residence: `Korea Republic of`
- Category: `Apps for Your Life`
- Code repository: `https://github.com/Artemis-ignis/ddakdama`
- Test URL: `https://ddakdama.ddakdama.workers.dev/mcp`
- `/feedback` Session ID: Devpost 제출 양식에만 기록됨(공개 저장소에는 원문을 보관하지 않음)
- Demo video URL: `https://youtu.be/hpRkAGgw03c` (51초, 공개 링크 접근 확인)
- Plugin installation/testing instructions: 위 “심사자 설치·테스트 안내” 사용

## 제출 전 체크리스트

- [x] Devpost 참가 등록
- [x] DdakDama 프로젝트 초안 생성
- [x] 공개 MCP 및 웹 페이지 배포
- [x] 공개 MCP 5종·7개 페어링/전송/ACK/연결 해제 검증
- [x] 서로 다른 두 사용자 데이터 격리 검증
- [x] lint, typecheck, unit/integration, E2E, build 통과
- [x] 최신 코드 GitHub `main` 반영 확인 — v1.0.2 검색 복구·데모 제작 파이프라인 포함
- [x] 공개 GitHub 저장소 접근 확인 — 심사자 별도 초대 불필요
- [x] `/feedback` Codex Session ID 입력
- [x] 공개 YouTube 데모 영상 연결 및 링크 접근 확인
- [x] Devpost 썸네일 업로드 및 공개 프로젝트 페이지 반영 확인
- [x] Devpost 최종 제출 완료 (`Submitted`)

## 해커톤 기간에 새로 확장한 부분

2026-07-13 이후 작업은 Git 커밋과 Codex 작업 기록으로 확인할 수 있습니다. 주요 확장은 공개 Cloudflare Worker/Durable Object 다중 사용자 서비스, GPT 앱과 확장 프로그램의 일회성 페어링 및 영구 연결, 후보 직접 선택과 오타 복구, 지연 가격 렌더링과 실제 SKU 검증, 장바구니 delta 및 재시작 중복 방지, 실제 담긴 가격 합계, 새 목록 시작 흐름, 다크모드 ChatGPT 위젯입니다.
