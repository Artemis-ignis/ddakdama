# DdakDama — Devpost 제출 입력 가이드

## 프로젝트 기본 정보

| Devpost field | Value |
| --- | --- |
| Name | `DdakDama` |
| Elevator pitch | `Turn any shopping list into a verified Coupang cart.` |
| Category | `Apps for Your Life` |
| Website | `https://ddakdama.ddakdama.workers.dev` |
| Code repository | `https://github.com/Artemis-ignis/ddakdama` |
| Demo video | `https://youtu.be/Lpdt90FKWVA` |

## About the project

Paste this Markdown into Devpost.

```markdown
## Inspiration

AI can recommend a complete shopping routine in seconds, but acting on that recommendation is still painfully manual. Users must search every product again, distinguish 100 mg from 240 tablets, work out whether “two items” means two single units or one two-pack, compare near-identical listings, and then verify the cart one more time. DdakDama removes that gap between a useful shopping list and a trustworthy cart.

## What it does

DdakDama turns a free-form, multi-line shopping list into an editable plan with product names, unit sizes, strengths, package contents, and requested physical quantities. Its ChatGPT app lets the user review the interpretation, while the paired Chrome extension searches Coupang, shows matching candidates with prices and delivery information, and calculates an estimated total.

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

- Correctly parses the five-line reference list as five product types and seven physical units.
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
- **/feedback Session ID:** 핵심 개발 작업을 수행한 Codex 세션에서 `/feedback`으로 발급받아 입력합니다. 이 값은 추측해서 넣으면 안 됩니다.

## 이미지 갤러리

Upload folder: `artifacts/devpost-gallery/upload/`

- 10 JPG files, 1800×1200 (3:2), all below 5MB
- Real DdakDama public site, Chrome extension, and ChatGPT handoff captures only
- Upload in the order `01-public-landing.jpg` through `10-end-to-end-flow.jpg`

## 제출 전 확인

- YouTube Studio에서 데모 영상이 **Public**이고 3분 미만인지 확인합니다.
- private repo의 Collaborators에 `testing@devpost.com`, `build-week-event@openai.com`을 Read 권한으로 초대합니다.
- 최신 코드를 GitHub에 push한 뒤 Devpost의 repository URL이 같은 저장소인지 확인합니다.
