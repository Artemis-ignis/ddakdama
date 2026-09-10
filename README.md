# DdakDama

**Turn an AI shopping list into a reviewable Coupang cart.**

DdakDama is a ChatGPT app and Chrome Side Panel extension for the last mile of AI-assisted shopping. It turns a free-form list into an editable purchase plan, lets the user compare real candidates, and adds only user-approved items to the cart.

> DdakDama never automates payment or order confirmation. The user reviews the final Coupang cart.

## The problem

An AI can recommend a shopping routine quickly, but the last mile is still manual. Users have to search each item again, distinguish product strength from package contents, interpret physical quantity, compare candidates, and check whether the final cart is correct.

### User job

> “Turn what I meant to buy into a cart I can understand and approve, without silently choosing the wrong package or purchasing anything.”

## Product decisions

| Decision | Why it matters |
| --- | --- |
| Separate product identity, specification, package contents, and requested quantity | `100 mg` can be a strength and `240 tablets` can be the package; neither means “buy 100” or “buy 240”. |
| Keep `EXACT` and `REVIEW` candidates distinct | A search result can be useful without being safe to select automatically. |
| Confirm price on the detail page | Search-card prices are not enough for a cart action. |
| Check the cart quantity delta after an add attempt | A click is not proof that the intended item and quantity entered the cart. |
| Keep partial failures visible | The user needs a recovery path instead of a false all-success state. |

## Core flow

```text
Natural-language list
  → parsed purchase plan
  → candidate comparison
  → identity / package validation
  → user approval
  → cart action
  → cart-result review
```

These two inputs must not be interpreted the same way:

```text
SKIN1004 Hyalu-Cica Water-Fit Sun Serum 50 mL × 2
Doctor's Best High Absorption Magnesium 100 mg, 240 tablets
```

The first requests two physical 50 mL units. The second requests one bottle; `100 mg` is strength and `240 tablets` is package contents.

## Product surfaces

| Surface | Responsibility |
| --- | --- |
| Chrome extension | List input, candidate comparison, quantity planning, detail validation, cart actions, and result review |
| ChatGPT app | Intent capture, structured list review, and secure handoff to the paired extension |
| Cloudflare Worker + Durable Object | Public MCP endpoint, short-lived pairing, device-scoped handoff, isolation, and rate limits |
| Shared core | Deterministic parsing, unit classification, quantity planning, product matching, and cart contracts |

## What I verified

The repository has regression coverage for parsing, quantity planning, pairing, candidate selection, cart verification, and rendered UI states. The public demo uses fixture-backed store data for repeatability; fixture results are not presented as customer or revenue metrics.

```powershell
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Built with OpenAI

- **GPT-5.6**: understands shopping intent and invokes structured tools through the ChatGPT app.
- **Codex**: used to inspect the repository, implement the typed parser and quantity planner, connect the Apps SDK/MCP flow, build the cart state machine, harden the Worker service, and create regression tests.

The important product boundary is not “AI selected an item”. It is whether the user can see why the item was selected and approve the final cart.

## Public links

- Website: <https://ddakdama.ddakdama.workers.dev>
- MCP endpoint: <https://ddakdama.ddakdama.workers.dev/mcp>
- Privacy: <https://ddakdama.ddakdama.workers.dev/privacy>
- Demo: <https://youtu.be/hpRkAGgw03c>

## Safety boundaries

- No automatic checkout, purchase, or order confirmation.
- No Coupang passwords, card numbers, payment methods, or raw session cookies.
- No CAPTCHA or security-check bypass.
- Price, stock, shipping, and final order total remain user-confirmed facts on Coupang.

## Status

Public product prototype. The repository documents product hypotheses, decisions, validation boundaries, and implementation evidence; it does not claim external user growth, conversion, or revenue without a measured source.

