# Promo Studio

Promo Studio turns a campaign brief into a **tested, reviewable storefront variant** using **Codex** (TypeScript SDK or `codex exec`) or **Pi** (`pi --mode json`) in an isolated workspace—with live activity, validation, and a durable receipt.

[![Watch the Promo Studio walkthrough](https://img.youtube.com/vi/zPRLtiP8v7w/maxresdefault.jpg)](https://youtu.be/zPRLtiP8v7w)

## What you are seeing

A user picks a campaign goal for the Ribbed Market Tote, clicks **Create Variant**, and Promo Studio:

1. Copies `templates/storefront` into `agent-workspaces/run-<id>/storefront`.
2. Runs the selected agent harness with a real software task (edit code, test, build, manifest).
3. Streams JSONL activity on `/runs/<id>` while the worker executes.
4. Accepts the run only when tests, build, commerce invariants, and safe changed files pass.
5. Stores preview HTML, diff, transcript, and receipt for review.

## Who this is for

- **Evaluators** who need proof of code edits, not mock copy.
- **Commerce teams** exploring campaign-page iteration with audit trails.
- **Developers** who want a compact pattern for agent workspaces, streaming, validation, and receipts.

## Agent harnesses

| Core | Harness | Runtime |
|------|---------|---------|
| `codex` | `sdk` (default) | `@openai/codex-sdk` streamed JSONL |
| `codex` | `exec` | `codex exec --json` subprocess |
| `pi` | `json` | `pi --mode json` with run-scoped `--session-id` |

Pick **agent core**, **harness**, and **model** in the studio UI (gear icon) or via `.env` defaults. See [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md) for the full contract.

## Quick start (no live agent required)

**Prerequisites:** Node.js `>=22.19.0 <27`, npm.

```bash
npm install
npm run setup
npm run dev
```

Sign in at the URL Next.js prints (usually `http://localhost:3000`):

| Field | Value |
|-------|-------|
| Email | `demo@promostudio.test` |
| Password | `promo-studio` |

Then:

1. **`/proof`** — seeded execution receipt (fastest trust path).
2. **`/studio`** — product, brief presets, **Create Variant** form.
3. **`/runs/seeded-demo-variant`** or **`/history`** — preview, diff, validation, transcript.

The seeded proof path does not require Codex or Pi credentials.

**Dependency boundary:** run `npm install` only at the repo root. Agent workspaces copy the storefront template and resolve Vite/Vitest/React from root `node_modules` (see [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md)).

## Run a live variant (all three harnesses)

Live runs need **two terminals** plus the browser:

```bash
# Terminal 1 — web app
npm run dev

# Terminal 2 — claims queued runs and executes agents
npm run runs:worker
```

In the browser: **`/studio`** → choose agent settings → **Create Variant** → watch **`/runs/<id>`** (activity stream updates while `runs:worker` is running).

### Configuration

Copy `.env.example` to `.env` when you need overrides. Common variables:

| Variable | Purpose |
|----------|---------|
| `AGENT_CORE` | Default `codex` or `pi` |
| `CODEX_RUNTIME` | `sdk` (default) or `exec` |
| `CODEX_AUTH_MODE` | `auto`, `subscription`, or `api-key` |
| `CODEX_MODEL`, `CODEX_REASONING_EFFORT` | Codex model and effort |
| `PI_MODEL` | Pi model ref (`provider/model` or `provider/model:thinking`) |
| `CODEX_API_KEY` / `OPENAI_API_KEY` | API-key Codex auth |
| `CODEX_TIMEOUT_MS`, `PI_TIMEOUT_MS` | Per-core timeouts (default 300000) |

**Doctors** (run before debugging live agents):

```bash
npm run agent:doctor    # workspace + template
npm run codex:doctor    # Codex SDK / exec
npm run pi:doctor       # Pi JSON CLI
```

### Verify all harnesses (optional)

With `dev` + `runs:worker` running:

```bash
npm run agent:harness-http-e2e
```

Runner-only smoke (no HTTP; uses `dev.db`):

```bash
DATABASE_URL=file:./dev.db npm run agent:harness-e2e
```

## Proof and verification

Full local gate:

```bash
npm run validate
```

Storefront template only:

```bash
npm --prefix templates/storefront test
npm --prefix templates/storefront run build
```

Commerce invariants enforced in the template: price `$42.00`, SKU `RMT-001`, inventory `3`, cart API consistency, original product image unchanged.

## How it works

```text
POST /api/variant-runs  →  enqueue VariantRun (queued)
npm run runs:worker     →  claim run → agent harness → JSONL transcript
                        →  validate manifest + changed files → preview + receipt
GET /api/variant-runs/[id]  →  live poll (status + recent events)
```

**Design choices:** isolated workspaces per run, one receipt per run, validation before trust, SDK-default Codex with exec fallback, Pi sessions under `artifacts/pi-sessions/` (gitignored).

## Project map

| Path | Purpose |
|------|---------|
| `app/` | Login, studio, run detail, history, proof, API routes |
| `components/` | Campaign form, activity stream, previews, diffs, receipts |
| `lib/agent/` | Runner, Codex/Pi adapters, transcript, validation |
| `lib/workspace.ts` | Workspace copy and change detection |
| `templates/storefront/` | Vite storefront the agent edits |
| `tests/` | Vitest (routes, runner, validation, UI) |
| `docs/AGENT_INTEGRATION.md` | Harness-agnostic integration |
| `docs/CODEX_INTEGRATION.md` | Codex-specific details |
| `docs/PI_INTEGRATION.md` | Pi-specific details |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run setup` | Reset SQLite DB and seed demo data |
| `npm run dev` | Next.js dev server (webpack; use `dev:turbo` only if you accept higher CPU) |
| `npm run runs:worker` | Execute queued variant runs (**required for live variants**) |
| `npm run validate` | DB + typecheck + lint + test + build |
| `npm run reset:workspaces` | Remove generated `agent-workspaces/` trees |
| `npm run agent:harness-e2e` | Live E2E: Codex SDK, exec, Pi (runner path) |
| `npm run agent:harness-http-e2e` | Live E2E via HTTP + worker |
| `npm run codex:doctor` / `npm run pi:doctor` | Harness setup checks |

## Limits

- Local SQLite demo, not multi-tenant production.
- Live runs depend on local Codex auth and/or Pi CLI configuration.
- Generated artifacts live under `agent-workspaces/` and `artifacts/`; clear with `reset:workspaces` when needed.

## Next step

Run the quick start, open **`/proof`**, then start **`runs:worker`** and create a live variant from **`/studio`** with each harness you care about.
