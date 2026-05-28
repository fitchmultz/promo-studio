# Promo Studio

Promo Studio is a **multi-agent** commerce demo: one campaign brief, one isolated storefront workspace, and your choice of **Codex** (TypeScript SDK or `codex exec`), **Pi** (`pi --mode json`), or **Cursor SDK** (`@cursor/sdk`) to implement the variant—with live activity, shared validation gates, and a durable receipt you can inspect before anything ships.

[![Watch the Promo Studio walkthrough](https://img.youtube.com/vi/zPRLtiP8v7w/maxresdefault.jpg)](https://youtu.be/zPRLtiP8v7w)

## What you are seeing

A user picks a campaign goal for the Ribbed Market Tote, selects an agent core in studio settings, clicks **Create Variant**, and Promo Studio:

1. Spins up an isolated copy of the storefront template for that run only.
2. Hands the selected agent a real software task: edit source, run tests, run the build, write a manifest.
3. Streams harness-normalized activity on the run page while work is in progress.
4. Accepts the variant only when the manifest, tests, build, commerce invariants, and changed-file checks pass.
5. Leaves behind preview HTML, a code diff, the JSONL transcript, and an execution receipt labeled with the agent core and harness used.

The payoff is not a paragraph of marketing copy—it is a bounded, **comparable** agent workflow with evidence.

## Multi-agent architecture

```text
Campaign brief → isolated storefront workspace → agent core (Codex | Pi | Cursor)
              → adapter streams JSONL → shared validation → preview + receipt
```

| Layer | Role |
|-------|------|
| **Host** | Next.js app: auth, studio form, run detail, history, proof |
| **Runner** | `lib/agent/runner.ts` — queue, execute, validate, finalize (harness-agnostic) |
| **Adapters** | Codex SDK/exec, Pi JSON CLI, Cursor SDK — same transcript contract |
| **UI** | Activity stream, phase stepper, diff, receipt — keyed by `agentCore` |

Switch cores from the studio gear menu or `.env`; receipts record `agentCore`, `agentHarness`, and model selection so you can compare runs side by side.

## Who this is for

- **Evaluators** who need proof that an agent changed code and validated it—not a static mock—and who want to compare Codex, Pi, and Cursor on the same task.
- **Commerce and growth teams** exploring campaign-page iteration with human review before publish.
- **Developers** who want a compact reference for multi-agent workspaces, streaming, validation, and receipts.

## The problem

Most AI commerce demos stop at generated text or a screenshot. Reviewers cannot see what files changed, whether the storefront still builds, or whether SKU, price, and cart behavior stayed correct—and they cannot swap agents without rebuilding the demo.

Promo Studio treats each brief as an isolated code run with inspectable proof: transcript, diff, tests, build, manifest, preview, and receipt—**regardless of which agent core ran**.

## What it does

| Doubt | Capability | Where to look |
|-------|------------|---------------|
| Did the agent actually edit code? | Per-run workspace under `agent-workspaces/run-<id>/storefront` | `/runs/<id>` diff + transcript |
| Can I watch it work? | JSONL activity normalized per core (Codex, Pi, Cursor) | Activity stream on `/runs/<id>` |
| Did commerce facts survive? | Manifest + template invariant tests | Receipt validation panel, `lib/validation.ts` |
| Can I audit later? | Stored core, harness, model, prompt, transcript, changed files, preview | `/proof`, `/history`, `RunReceipt` |
| Can I compare agents? | Four harnesses, one validation pipeline | Studio settings (gear), [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md) |

## Agent harnesses

| Core | Harness | Runtime |
|------|---------|---------|
| `codex` | `sdk` (default) | `@openai/codex-sdk` streamed JSONL |
| `codex` | `exec` | `codex exec --json` |
| `pi` | `json` | `pi --mode json` (run-scoped session) |
| `cursor` | `sdk` | `@cursor/sdk` local agent (`composer-2.5-fast` default) |

Choose core, harness, and model in the studio UI or via `.env` defaults (`AGENT_CORE`, `CODEX_*`, `PI_MODEL`, `CURSOR_*`).

## Fastest way to see it work

**Prerequisites:** Node.js `>=22.19.0 <27`, npm.

```bash
npm install
npm run setup
npm run dev
```

Sign in (`demo@promostudio.test` / `promo-studio`), then:

1. **`/proof`** — seeded receipt; see the evidence shape without spending a live agent run.
2. **`/studio`** — product, campaign presets, **agent settings** (core + harness + model), **Create Variant**.
3. **`/runs/seeded-demo-variant`** or **`/history`** — before/after preview, code diff, validation, transcript.

The seeded path does not require agent credentials. Creating a **new** live variant requires auth for the core you select (Codex subscription/API key, Pi model configuration, or `CURSOR_API_KEY`); see `.env.example` and the doctor scripts in [Scripts](#scripts).

## How it works

Each run is sandboxed: the host app and `templates/storefront` stay untouched; only the copied workspace changes. One receipt per run captures enough context to review or demo the outcome days later—including which agent core executed the work.

**Documentation:** [docs/README.md](docs/README.md) (index) · [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md) (shared contract) · [docs/CODEX_INTEGRATION.md](docs/CODEX_INTEGRATION.md) · [docs/PI_INTEGRATION.md](docs/PI_INTEGRATION.md) · [docs/CURSOR_SDK_INTEGRATION.md](docs/CURSOR_SDK_INTEGRATION.md)

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
| `components/` | Campaign form, agent settings, activity stream, previews, diffs, receipts |
| `lib/agent/` | Multi-agent runner, Codex/Pi/Cursor adapters, transcript, scheduling |
| `templates/storefront/` | Vite storefront any agent modifies |
| `tests/` | Vitest coverage (all cores + shared runner) |
| `docs/` | Multi-agent integration contracts |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run setup` | Seed demo user, product, and example receipt |
| `npm run dev` | Start the studio app |
| `npm run runs:worker` | Optional: drain stuck `queued` runs (Create Variant auto-starts agents) |
| `npm run validate` | Full CI-style gate |
| `npm run agent:doctor` | Shared template/workspace checks (all cores) |
| `npm run codex:doctor` / `pi:doctor` / `cursor:doctor` | Per-core harness checks |
| `npm run codex:smoke` / `cursor:smoke` | Harness unit smoke gates |
| `npm run reset:workspaces` | Clear generated workspaces |

## Limits

- Local SQLite demo, not a hosted multi-tenant product.
- Live variants depend on credentials for the agent core you select.
- Small storefront by design so changes and review stay easy to follow.

## Next step

Open **`/proof`**, then **`/studio`**—pick Codex, Pi, or Cursor in agent settings, create a variant, and walk the run page while activity streams in.
