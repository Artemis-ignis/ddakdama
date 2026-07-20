# DdakDama

**Turn a shopping list into a reviewable Coupang cart.**

DdakDama is a ChatGPT app and Chrome Side Panel extension for the last mile of AI-assisted shopping. It takes a free-form multi-line list, separates product specifications from purchase quantities, lets the user compare Coupang candidates, and adds only user-approved items to the cart.

> DdakDama never automates payment or order confirmation. Users always review the final Coupang cart themselves.

## Why it exists

AI can recommend a shopping routine in seconds, but buying it is still manual. A user must search every item again, distinguish `100 mg` from `240 tablets`, decide whether `2 items` means two singles or one two-pack, and verify the final cart.

DdakDama makes that transition explicit and verifiable.

## What it does

- Parses product names, sizes, strengths, package contents, and requested physical quantities.
- Handles quantity plans safely: two single products and one two-pack can both satisfy a request for two items; an oversized three-pack is flagged instead of silently selected.
- Shows product candidates with delivery, seller, package, and price information.
- Separates search availability from automatic selection: any real search result remains available for review, while only an exact identity-and-package match can be selected automatically.
- Uses detail-page price confirmation before automatic cart actions.
- Checks the cart quantity delta after each add attempt instead of treating a button click as success.
- Keeps partial failures visible and provides direct recovery paths.
- Supports adding more items after a ChatGPT-imported list without discarding existing choices.
- Keeps secrets, raw server details, and payment credentials out of consumer-facing screens.

## Product surfaces

| Surface | Responsibility |
| --- | --- |
| **Chrome extension** | List input, candidate comparison, quantity planning, Coupang detail validation, cart actions, and cart-result review. |
| **ChatGPT app** | Structured list review and secure handoff to a paired extension. |
| **Cloudflare Worker + Durable Object** | Public MCP endpoint, short-lived pairing codes, device-scoped handoffs, isolation, and rate limits. |
| **Shared core package** | Deterministic parser, unit classifier, quantity planner, product matching, and cart-result contracts. |

## The quantity problem

These inputs are intentionally different:

```text
SKIN1004 Hyalu-Cica Water-Fit Sun Serum 50 mL × 2
Doctor's Best High Absorption Magnesium 100 mg, 240 tablets
```

The first requests two physical 50 mL units. The second requests one bottle; `100 mg` is strength and `240 tablets` is the package contents. DdakDama models these fields independently before it plans the cart quantity.

## Built with OpenAI

### GPT-5.6

GPT-5.6 is used through the ChatGPT app to understand a user's shopping intent and invoke structured tools. The app turns natural language into an editable plan; deterministic shared schemas and validation guard the downstream shopping action.

### Codex

Codex was used throughout development to analyze the repository, design and implement the typed parser and quantity planner, build the Chrome cart state machine, connect the Apps SDK/MCP flow, harden the public Worker service, iterate on the user interface, and create and run regression tests for parsing, pairing, candidate selection, cart verification, and rendered UI states.

## Repository layout

```text
apps/
  extension/  Manifest V3 Chrome Side Panel extension
  server/     Local development MCP service and widget tooling
  worker/     Public Cloudflare Worker and Durable Object service
packages/
  core/       Shared parser, quantity, matching, and cart contracts
```

## Local development

Requirements: Node.js 20+ and pnpm.

```powershell
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

For an unpacked extension build, use the directory containing the generated `manifest.json`; do not select a source parent folder that does not contain a manifest.

## Public service

- Website: https://ddakdama.ddakdama.workers.dev
- MCP endpoint: https://ddakdama.ddakdama.workers.dev/mcp
- Privacy: https://ddakdama.ddakdama.workers.dev/privacy
- Terms: https://ddakdama.ddakdama.workers.dev/terms
- Support: https://ddakdama.ddakdama.workers.dev/support

The public Worker is designed so normal users do not need to run a laptop-hosted server. The local server is for development only.

## OpenAI Build Week

DdakDama is being built for the **Apps for Your Life** track. During Build Week, the project expanded from a prototype into a public-service architecture with device pairing, handoffs, editable candidate recovery, strict quantity planning, detail-price checks, cart-delta validation, restart-safe job handling, and light/dark UI support.

The submitted demo is [available on YouTube](https://youtu.be/hpRkAGgw03c). It is a 51-second narrated, subtitle-burned walkthrough of the current v1.0.2 ChatGPT-to-extension flow. The recording uses fixture-backed store data for repeatability; checkout is never automated.

### v1.0.2 search recovery

The current extension release uses the full request, product identity, and core-product fallback queries without ever searching for a size or quantity alone. Modern Coupang `ProductUnit` cards are parsed directly. A found candidate is classified as **EXACT** (safe to auto-select) or **REVIEW** (show it and ask the user to confirm); only a real zero-result search is **NONE**.

See [docs/BUILD_WEEK_SUBMISSION.md](docs/BUILD_WEEK_SUBMISSION.md) for submission material and [docs/GPT_APP_SETUP_KO.md](docs/GPT_APP_SETUP_KO.md) for the ChatGPT app setup flow.

## Safety boundaries

- No automatic checkout, purchase, or order confirmation.
- No collection of Coupang passwords, card numbers, payment methods, or raw session cookies.
- No CAPTCHA or security-check bypass.
- Product price, stock, shipping, and final order total can change; users confirm the final cart on Coupang.
