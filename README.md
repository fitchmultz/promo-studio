# Promo Studio — Multi-Harness Commerce Demo

Promo Studio helps commerce teams and evaluators see how **Codex** or **Pi** can turn a campaign brief into a tested, reviewable storefront variant instead of a throwaway text mockup. Switch agent core, harness (SDK vs CLI), and model from the studio form or `.env`.

[![Watch the Promo Studio walkthrough](https://img.youtube.com/vi/zPRLtiP8v7w/maxresdefault.jpg)](https://youtu.be/zPRLtiP8v7w)

## What you are seeing

A user picks a campaign goal for the Ribbed Market Tote, clicks **Create Variant**, and Promo Studio runs the selected agent as a commerce code agent:

- The selected agent receives a real software task, not a copywriting prompt.
- A fresh storefront workspace is copied from `templates/storefront` for that run.
- The agent is instructed to edit source files, run `npm test`, run `npm run build`, and write a manifest that reports the outcome.
- Promo Studio streams the JSONL activity, stores the after-preview HTML, changed-file list, transcript, validation result, and receipt, then renders the preview and diff for review.

The payoff is a bounded agent workflow: useful creative output, plus the evidence needed to trust and review what changed.

## Who this is for

- **Evaluators and reviewers** who want proof that the demo uses Codex or Pi to modify and validate code, not just generate UI text.
- **Commerce and growth teams** exploring safe campaign-page iteration with human review before publish.
- **Developers** looking for a compact pattern for agent workspaces, live observability, validation gates, and durable receipts.

## The problem

AI commerce demos often stop at a generated paragraph or a static mockup. That is hard to trust because the reviewer cannot see what files changed, whether the storefront still builds, or whether product facts were preserved.

Promo Studio treats each campaign request as an isolated code run with visible proof: transcript, changed files, tests, build, manifest, preview HTML, and receipt.

## What it does

| Reader doubt | Promo Studio capability | Proof in this repo |
| --- | --- | --- |
| "Did Codex actually edit code?" | Creates `agent-workspaces/run-<id>/storefront` and runs the selected harness with write access to that isolated copy. | `lib/workspace.ts`, `lib/codex-runner.ts`, `/runs/<id>` transcript and diff tabs |
| "Can I see the agent work live?" | Normalizes streamed Codex/Pi events into JSONL and renders them while the run is active. | `components/ActivityStream.tsx`, persisted `VariantRun.transcript` |
| "Did the variant keep commerce facts intact?" | Accepts a run only when the manifest reports tests, build, and invariants passed; required commands are present; and changed-file paths are safe. | `templates/storefront/tests/`, `lib/validation.ts`, receipt validation panel |
| "Can a reviewer audit the result later?" | Stores runtime, auth mode, model, reasoning effort, prompt, transcript, changed files, manifest, preview HTML, and validation outcome. | `/proof`, `components/RunReceipt.tsx`, `docs/CODEX_INTEGRATION.md` |
| "Is this easy to inspect locally?" | Seeds a demo user, product, and completed example receipt so the review UI works before a live agent run. | `prisma/seed.ts`, `npm run setup`, `/proof` |

## Fastest way to see it work

Prerequisites: Node.js `>=22.19.0` and npm. The seeded proof path does not require a `.env` file or live agent credentials.

```bash
npm install
npm run setup
npm run dev
```

Open the URL printed by Next.js, then sign in:

- Email: `demo@promostudio.test`
- Password: `promo-studio`

Fastest proof path after login:

1. Open `/proof` to inspect the seeded execution receipt.
2. Open `/studio` to see the product, campaign brief presets, and **Create Variant** flow.
3. Open `/runs/seeded-demo-variant` or `/history` to inspect preview, code diff, validation, and transcript tabs.

Expected local result: the app starts with a seeded Ribbed Market Tote product and a completed `seeded-demo-variant` receipt. Creating a new live agent variant also requires a working local Codex auth setup or Pi CLI/model configuration.

Dependency boundary: run `npm install` once at the repository root. Isolated storefront workspaces copy the template files except ignored generated/dependency artifacts (`node_modules`, `dist`, `.DS_Store`) and resolve Vite, Vitest, React, and other template tooling from the root `node_modules`; do not run per-workspace installs unless you intentionally change that boundary.

## Run a live agent variant

After setup, start a worker in a second terminal, then go to `/studio`, choose a campaign goal, optionally edit the brief, and click **Create Variant**.

```bash
npm run runs:worker
```

The web app creates a queued run receipt; the worker claims queued runs and finalizes them. A live run is designed to:

1. Copy `templates/storefront` into `agent-workspaces/run-<id>/storefront`.
2. Run Codex through the TypeScript SDK by default, or Pi through `pi --mode json` with an explicit run-scoped session ID when selected.
3. Stream activity to the run page.
4. Instruct the agent to run `npm test` and `npm run build` in the storefront workspace.
5. Validate `artifact/manifest.json` and changed files.
6. Persist the after-preview HTML, changed-file list, transcript, prompt, manifest, and receipt, then render the before/after preview and code diff.

Agent runtime settings:

- `CODEX_RUNTIME=sdk` is the default.
- `CODEX_RUNTIME=exec` preserves the direct `codex exec` fallback.
- `CODEX_AUTH_MODE` supports `auto`, `subscription`, and `api-key`.
- Subscription mode expects a working local Codex login.
- API-key mode requires `CODEX_AUTH_MODE=api-key` plus `CODEX_API_KEY` or `OPENAI_API_KEY`.
- `CODEX_MODEL`, `CODEX_REASONING_EFFORT`, and `CODEX_TIMEOUT_MS` tune Codex runs. `PI_MODEL` and `PI_TIMEOUT_MS` tune Pi runs.

## Proof and verification

Full local gate:

```bash
npm run validate
```

`npm run validate` resets and seeds the local database, runs typecheck, format check, lint, Vitest, and a production Next.js build.

Storefront-only gate (uses the root `node_modules`; do not install inside the template/workspace):

```bash
npm --prefix templates/storefront test
npm --prefix templates/storefront run build
```

The storefront template protects these commerce invariants:

- Price: `$42.00`
- SKU: `RMT-001`
- Inventory: `3`
- Cart API returns the same SKU, quantity, and unit price
- Original tote image remains visible and unmodified

## How it works

```text
POST /api/variant-runs
  -> authenticate and check same-origin POST
  -> copy templates/storefront into agent-workspaces/run-<id>/storefront
  -> build a campaign-specific software task prompt
  -> enqueue a durable VariantRun row
npm run runs:worker
  -> claim queued runs and run the selected agent harness in the isolated storefront workspace
  -> persist streamed JSONL transcript lines
  -> validate manifest-reported tests/build/invariants plus safe changed files
  -> inline the built preview HTML
  -> render run evidence in /runs/<id>, /history, and /proof
```

Key implementation choices:

- **Isolation first** — each run modifies a copied storefront, never the host app or source template.
- **One receipt per run** — the database stores enough execution context to review the run after the fact.
- **Validation before trust** — accepted variants must produce a manifest reporting passing tests, build, and commerce-invariant checks, then pass schema and changed-file validation.
- **SDK default, CLI fallback** — `@openai/codex-sdk` is the default runtime, with a preserved `codex exec` path for environments that need it.
- **Deterministic Pi sessions** — Pi JSON runs use the variant run ID as `--session-id` and store session files under gitignored `artifacts/pi-sessions/` for automation auditability without polluting storefront diffs.

See `docs/CODEX_INTEGRATION.md` for the runtime contract and required manifest shape.

## Current status and limits

What is working today:

- Local Next.js app with seeded auth, product, and example receipt.
- Isolated storefront workspace creation and change detection.
- Codex SDK runtime with `codex exec` fallback, plus Pi JSON CLI support.
- Live transcript rendering, run history, diff view, before/after preview, and admin proof page.
- Tests for auth, routes, config, workspace isolation, runner lifecycle, validation, and UI rendering.

Boundaries to know before production use:

- This is a local demo app backed by SQLite, not a hosted multi-tenant production service.
- Live variant creation depends on local Codex or Pi credentials and network/runtime availability.
- Generated workspaces are local artifacts under `agent-workspaces/` and can be cleared with `npm run reset:workspaces`.
- The storefront is intentionally small so the agent change, validation path, and review surface stay easy to inspect.

## Project map

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes for login, studio, run detail, history, proof, and API endpoints |
| `components/` | Campaign form, live activity stream, before/after preview, diff, receipt, and run history UI |
| `lib/agent/` and `lib/codex-runner.ts` | Harness-neutral runner plus Codex/Pi adapters, JSONL streaming, manifest parsing, validation, and persistence |
| `lib/workspace.ts` | Storefront workspace copy and changed-file detection |
| `lib/validation.ts` | Manifest schema, safe path checks, forbidden changed files, and receipt summary |
| `prisma/` | SQLite schema and seeded demo user, product, and example run |
| `templates/storefront/` | Vite storefront template that the agent modifies during each isolated run |
| `tests/` | Vitest coverage for auth, routes, config, workspace isolation, runner lifecycle, validation, and UI rendering |
| `docs/CODEX_INTEGRATION.md` | Codex runtime flow, sandbox contract, and receipt requirements |

## Useful scripts

```bash
npm run setup              # reset local SQLite DB and seed demo data
npm run dev                # start Next.js dev server; Next.js falls forward if port 3000 is busy
npm run typecheck          # generate Prisma/Next types and run TypeScript checks
npm run lint               # run Biome lint
npm test                   # reset test DB, seed, and run Vitest
npm run build              # production build check
npm run validate           # full local gate
npm run reset:workspaces   # remove generated agent workspaces
npm run runs:worker        # claim and execute queued variant runs
npm run demo:zip           # zip git-tracked demo files only
```

## Next action

Run the quick start, sign in with the seeded demo account, and open `/proof` first. It shows the receipt shape that every live agent variant must earn before you inspect or share the generated storefront.
