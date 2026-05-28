# Promo Studio

Promo Studio turns a campaign brief into a **tested, reviewable storefront variant** using **Codex** (TypeScript SDK or `codex exec`) or **Pi** (`pi --mode json`)—with live activity, validation gates, and a durable receipt you can inspect before anything ships.

[![Watch the Promo Studio walkthrough](https://img.youtube.com/vi/zPRLtiP8v7w/maxresdefault.jpg)](https://youtu.be/zPRLtiP8v7w)

## What you are seeing

A user picks a campaign goal for the Ribbed Market Tote, clicks **Create Variant**, and Promo Studio:

1. Spins up an isolated copy of the storefront template for that run only.
2. Gives the selected agent a real software task: edit source, run tests, run the build, write a manifest.
3. Streams harness activity on the run page while work is in progress.
4. Accepts the variant only when the manifest, tests, build, commerce invariants, and changed-file checks pass.
5. Leaves behind preview HTML, a code diff, the JSONL transcript, and an execution receipt.

The payoff is not a paragraph of marketing copy—it is a bounded agent workflow with evidence.

## Who this is for

- **Evaluators** who need proof that Codex or Pi changed code and validated it, not a static mock.
- **Commerce and growth teams** exploring campaign-page iteration with human review before publish.
- **Developers** who want a compact reference for workspaces, streaming, validation, and receipts.

## The problem

Most AI commerce demos stop at generated text or a screenshot. Reviewers cannot see what files changed, whether the storefront still builds, or whether SKU, price, and cart behavior stayed correct.

Promo Studio treats each brief as an isolated code run with inspectable proof: transcript, diff, tests, build, manifest, preview, and receipt.

## What it does

| Doubt | Capability | Where to look |
|-------|------------|---------------|
| Did the agent actually edit code? | Per-run workspace under `agent-workspaces/run-<id>/storefront` | `/runs/<id>` diff + transcript |
| Can I watch it work? | JSONL activity normalized for Codex and Pi | Activity stream on `/runs/<id>` |
| Did commerce facts survive? | Manifest + template invariant tests | Receipt validation panel, `lib/validation.ts` |
| Can I audit later? | Stored model, harness, prompt, transcript, changed files, preview | `/proof`, `/history`, `RunReceipt` |
| Can I compare agents? | Swappable **Codex SDK**, **Codex exec**, and **Pi JSON** harnesses | Studio settings (gear), [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md) |

## Agent harnesses

| Core | Harness | Runtime |
|------|---------|---------|
| `codex` | `sdk` (default) | `@openai/codex-sdk` streamed JSONL |
| `codex` | `exec` | `codex exec --json` |
| `pi` | `json` | `pi --mode json` (run-scoped session) |

Choose core, harness, and model in the studio UI or via `.env` defaults.

## Fastest way to see it work

**Prerequisites:** Node.js `>=22.19.0 <27`, npm.

```bash
npm install
npm run setup
npm run dev
```

Sign in (`demo@promostudio.test` / `promo-studio`), then:

1. **`/proof`** — seeded receipt; see the evidence shape without spending a live agent run.
2. **`/studio`** — product, campaign presets, agent settings, **Create Variant**.
3. **`/runs/seeded-demo-variant`** or **`/history`** — before/after preview, code diff, validation, transcript.

The seeded path does not require Codex or Pi credentials. Creating a **new** live variant requires local agent auth (Codex subscription/API key or Pi model configuration); see `.env.example` and the doctor scripts in [Scripts](#scripts).

## How it works

```text
Campaign brief  →  isolated storefront workspace  →  agent harness (Codex or Pi)
                →  streamed JSONL  →  tests + build + manifest
                →  validation  →  preview + receipt + diff
```

Each run is sandboxed: the host app and `templates/storefront` stay untouched; only the copied workspace changes. One receipt per run captures enough context to review or demo the outcome days later.

Deeper integration notes: [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md), [docs/CODEX_INTEGRATION.md](docs/CODEX_INTEGRATION.md), [docs/PI_INTEGRATION.md](docs/PI_INTEGRATION.md).

## Commerce invariants

The Ribbed Market Tote template enforces demo-safe facts agents must preserve:

- Price `$42.00`, SKU `RMT-001`, inventory `3`
- Cart API returns matching SKU, quantity, and unit price
- Original product image remains visible and unmodified

## Verification

```bash
npm run validate
```

Storefront-only checks: `npm --prefix templates/storefront test` and `npm run build` (from that directory).

## Project map

| Path | Purpose |
|------|---------|
| `app/` | Login, studio, run detail, history, proof, APIs |
| `components/` | Campaign form, activity stream, previews, diffs, receipts |
| `lib/agent/` | Runner, Codex/Pi adapters, transcript, validation |
| `templates/storefront/` | Vite storefront the agent modifies |
| `tests/` | Vitest coverage |
| `docs/` | Harness and integration contracts |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run setup` | Seed demo user, product, and example receipt |
| `npm run dev` | Start the studio app |
| `npm run runs:worker` | Process queued live variant runs (local demo) |
| `npm run validate` | Full CI-style gate |
| `npm run agent:doctor` / `codex:doctor` / `pi:doctor` | Harness setup checks |
| `npm run reset:workspaces` | Clear generated workspaces |

## Limits

- Local SQLite demo, not a hosted multi-tenant product.
- Live variants depend on your Codex and/or Pi setup.
- Small storefront by design so changes and review stay easy to follow.

## Next step

Open **`/proof`**, then **`/studio`**—create a variant with the harness you care about and walk the run page while activity streams in.
