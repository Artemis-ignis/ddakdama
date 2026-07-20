# DdakDama — Devpost 제출 입력 가이드

## 프로젝트 기본 정보

| Devpost field | Value |
| --- | --- |
| Name | `DdakDama` |
| Elevator pitch | `Turn a shopping list into a verified, reviewable Coupang cart.` |
| Category | `Apps for Your Life` |
| Website | `https://ddakdama.ddakdama.workers.dev` |
| Code repository | `https://github.com/Artemis-ignis/ddakdama` |
| Demo video | `https://youtu.be/hpRkAGgw03c` (51초, 공개 접근 확인) |

## About the project

Paste this Markdown into Devpost.

```markdown
## Inspiration

AI can recommend a complete shopping routine in seconds, but acting on that recommendation is still painfully manual. Users must search every product again, distinguish 100 mg from 240 tablets, work out whether “two items” means two single units or one two-pack, compare near-identical listings, and then verify the cart one more time. DdakDama removes that gap between a useful shopping list and a trustworthy cart.

## What it does

DdakDama turns a free-form, multi-line shopping list into an editable plan with product names, unit sizes, strengths, package contents, and requested physical quantities. Its ChatGPT app lets the user review the interpretation, while the paired Chrome extension searches Coupang and keeps every real candidate visible for comparison.

The v1.0.2 flow separates search from automatic selection: full request → product identity → core-product fallback, never a size-only query. Exact product, size, and package matches are `EXACT`; non-exact real results are `REVIEW` and remain available for user confirmation; only a genuine zero-result search is `NONE`.

Before adding anything, DdakDama performs a preflight check for product identity, exact size, package count, live detail-page price, stock, required options, and the quantity that must be added to the cart. It never treats a button click as success: after each add, it checks the cart by product or vendor identifier and verifies the quantity delta. Partial failures remain visible, and payment is always completed manually by the user on Coupang.

## How we built it

The project is a TypeScript monorepo with four main layers:

- A deterministic parser and quantity planner shared by every surface.
- A Manifest V3 Chrome Side Panel extension that searches, compares, validates, and adds approved Coupang products.
- An OpenAI Apps SDK / MCP ChatGPT app that renders the review widget and securely hands plans to a paired extension.
- A Cloudflare Worker and Durable Object service that provides a stable public MCP endpoint, short-lived pairing codes, device-scoped grants, idempotent handoffs, rate limiting, and multi-user isolation.

GPT-5.6 is used to understand the user's shopping intent and invoke the correct structured tools. Codex accelerated repository analysis, architecture changes, parser and browser-state-machine implementation, visual iteration, security hardening, and the creation and execution of regression tests across the extension, MCP server, and public Worker.

## Challenges we ran into

Shopping quantities are deceptively difficult. “50 mL 2개” requests two physical units, while “100 mg 240정” describes one bottle containing 240 tablets. Coupang listings add another layer: a requested pair might be satisfied by two singles or one two-pack, prices can render later than the product shell, and similar titles can point to different SKUs.

We addressed this with typed unit classification, exact and explainable quantity plans, strict automatic matching, manual candidate recovery for fuzzy or misspelled input, detail-page price verification, and cart-delta checks keyed by stable identifiers. We also made extension jobs journaled and idempotent so a service-worker restart cannot silently add the same item twice.

## Accomplishments that we're proud of

- Preserves product identity from ChatGPT through the paired extension and covers the fixed 10-item summer-snack regression list.
- Separates 100 mg strength from a 240-tablet package and treats it as one bottle.
- Supports exact single-unit and multi-pack plans without hiding over-purchase.
- Preserves partial failures instead of showing a false success state.
- Verifies the actual cart quantity change after each add.
- Provides a public, multi-user MCP service with isolated pairing and handoff data.
- Supports both light and dark ChatGPT themes and keeps developer credentials out of consumer UI.
- Never automates payment or order confirmation.

## What we learned

The hardest part of an agentic shopping flow is not generating a recommendation; it is building a transparent verification boundary between probabilistic language understanding and a real commercial action. We learned to keep natural-language interpretation flexible while making product identity, quantity, price, and cart mutation deterministic and observable.

## What's next for DdakDama

Next, we plan to publish the extension through the Chrome Web Store, expand the store-adapter interface beyond Coupang, add price-history and substitution preferences, and introduce an opt-in affiliate benefit model that is transparent to users and compliant with each platform's rules.

## Built during OpenAI Build Week

Since July 13, 2026, we meaningfully extended the project with a public Cloudflare Worker and Durable Object multi-user service, persistent ChatGPT-to-extension pairing, idempotent handoff, fuzzy candidate recovery, delayed-price and real-SKU verification, cart-delta and restart-safe duplicate prevention, actual added-price totals, a new-list flow, and a dark-mode ChatGPT widget. The dated Git history and Codex session records distinguish this work from the earlier prototype.
```

## Built with

```text
GPT-5.6, Codex, OpenAI Apps SDK, Model Context Protocol (MCP), TypeScript, React, Chrome Extensions, Manifest V3, Cloudflare Workers, Cloudflare Durable Objects, Zod, Playwright, Vitest
```

## Judge test instructions

Paste this in the private judge-testing field.

```text
Live product page: https://ddakdama.ddakdama.workers.dev
Public MCP endpoint: https://ddakdama.ddakdama.workers.dev/mcp

The Chrome extension is required only for the Coupang cart workflow. The repository README contains Windows setup, packaging, and test commands. For a repeatable, no-purchase verification path, run `pnpm install`, `pnpm test:e2e`, and `pnpm build`; the test suite uses fixture-backed shopping pages and never automates checkout or order confirmation.

The public worker serves the MCP endpoint and short-lived pairing/handoff flow. No test account, payment method, Coupang password, or card data is required. Product prices, availability, and final cart totals can change, so users verify the final cart on Coupang.
```

## Plugin instructions

```text
Supported platform: Google Chrome on Windows 11 (Manifest V3 Side Panel extension). ChatGPT is used through an OpenAI Apps SDK / MCP app.

1. Open https://ddakdama.ddakdama.workers.dev.
2. For source-based verification, follow the README: install Node.js 20+ and pnpm, then run `pnpm install`, `pnpm test:e2e`, and `pnpm build`.
3. Load the generated extension directory containing `manifest.json` from chrome://extensions with Developer mode enabled.
4. The extension supports direct list input without ChatGPT. For ChatGPT handoff, connect the MCP endpoint shown in the README, create a short-lived pairing code in the extension, and complete the pairing in the ChatGPT app.
5. Review candidate, quantity, and price checks before adding. Checkout and order confirmation are intentionally manual.
```

## Required manual values

- **Submitter Type:** `Individual`
- **Country of Residence:** `Korea Republic of`
- **Category:** `Apps for Your Life`
- **/feedback Session ID:** Devpost 제출 양식에 반영 완료. 공개 저장소에는 세션 ID 원문을 기록하지 않습니다.

## 이미지 갤러리

Upload folder: `artifacts/devpost-gallery/upload/`

- 10 JPG files, 1800×1200 (3:2), all below 5MB
- Real DdakDama public site, Chrome extension, and ChatGPT handoff captures only
- Upload in the order `01-public-landing.jpg` through `10-end-to-end-flow.jpg`

## 제출 전 확인

- YouTube 데모 `https://youtu.be/hpRkAGgw03c` 공개 접근 및 51초 길이 확인: 완료.
- 저장소는 공개 `main` 브랜치이므로 심사자 별도 초대 불필요.
- GitHub `main`과 Devpost repository URL 일치 확인: 완료.
