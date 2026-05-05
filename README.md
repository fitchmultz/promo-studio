# Promo Studio — Codex Commerce Demo

Promo Studio is a Next.js demo that shows Codex acting as an autonomous commerce code agent. A user starts with a campaign goal and brief, then Promo Studio copies a storefront template into an isolated workspace, runs Codex through the official TypeScript SDK by default, streams live JSONL activity, validates the result, and stores an auditable receipt in SQLite.

This is not a static mockup or text-generation wrapper. Codex edits real storefront source files, runs tests, runs a production build, writes a manifest, and leaves behind the runtime invocation, prompt, transcript, changed files, preview HTML, and validation result for inspection.

## Walkthrough video

[Watch the Promo Studio walkthrough](https://youtu.be/zPRLtiP8v7w)

## Quick start

Use this path to run the demo locally:

```bash
npm install
npm run setup
npm run dev
```

Open the URL printed by Next.js and sign in. The default is `http://localhost:3000/login`. If port 3000 is already busy, Next.js dev mode automatically chooses another port and prints the selected URL.

- Email: `demo@promostudio.test`
- Password: `promo-studio`

No production build is required for `npm run dev`. The required setup step is `npm run setup`, which creates the local SQLite tables and seeds the demo login/product data. If login fails with a missing `User` table, run `npm run setup` from the project root and retry.

## Demo flow

1. Sign in and open `/studio`.
2. Choose a campaign goal chip. The campaign brief updates to match the selected intent unless you have typed a custom brief.
3. Click **Create Variant**.
4. Promo Studio copies `templates/storefront` into `codex-workspaces/run-<id>/storefront`.
5. Codex runs in `workspace-write`, reads files, edits source, runs `npm test`, runs `npm run build`, and writes `artifact/manifest.json`.
6. Watch the live Codex activity stream at the top of the run page.
7. Inspect the before/after preview, red/green code diff, execution receipt, manifest, input prompt, and transcript.
8. Open `/history` for persisted runs or `/proof` for the latest full execution receipt.

## What this demonstrates

- **Agentic code execution** — Codex works inside an isolated project directory instead of returning UI copy for the host app to render.
- **Workspace isolation** — every run gets a fresh storefront copy under `codex-workspaces/run-<id>/storefront`.
- **Live observability** — Codex JSONL output is persisted and rendered while the run is active.
- **Validation gates** — the storefront template protects commerce invariants with tests, and every accepted variant must pass both tests and build.
- **Auditable receipts** — the app records runtime, invocation, workspace path, model, reasoning effort, prompt, manifest, transcript, changed files, and preview HTML.
- **Human-readable review UI** — completed runs include before/after preview, colored diffs, validation receipt, and transcript tabs.

## Validation

```bash
npm run validate
```

`npm run validate` runs database setup, seed data, typecheck, format check, lint, tests, and production build. To check only the storefront template source of truth, run:

```bash
cd templates/storefront
npm install
npm test
npm run build
```

## Useful scripts

```bash
npm run setup              # reset local SQLite DB and seed demo data
npm run dev                # start Next.js dev server; defaults to 3000, Next.js falls forward if busy
npm run build              # optional production build check
npm run start              # optional production server after npm run build
npm run validate           # full local gate
npm run reset:workspaces   # remove generated Codex workspaces
npm run demo:zip           # zip git-tracked demo files only
```

## Structure

- `app/` — Next.js routes, auth pages, studio pages, and API routes.
- `components/` — form, stream, preview, diff, receipt, and history components.
- `lib/codex-runner.ts` — Codex SDK/exec runtime lifecycle, JSONL streaming, auth fallback, manifest parsing, and persistence.
- `lib/workspace.ts` — isolated storefront workspace copy and change detection.
- `lib/validation.ts` — manifest and commerce validation receipt checks.
- `templates/storefront/` — intentionally plain Vite storefront that Codex modifies.
- `prisma/` — SQLite schema and seeded demo user/product/run data.
- `tests/` — server, runner, workspace, validation, and route tests.

## Environment

- `DATABASE_URL` defaults to `file:./dev.db`.
- `SESSION_SECRET` is derived locally when omitted.
- `CODEX_AUTH_MODE` supports `auto`, `subscription`, or `api-key`.
- `CODEX_RUNTIME` defaults to `sdk`; set it to `exec` to use the direct `codex exec` fallback.
- `CODEX_MODEL` and `CODEX_REASONING_EFFORT` configure the selected Codex model arguments.
- `CODEX_API_KEY` or `OPENAI_API_KEY` are used only for explicit API-key mode or auto fallback.
- `CODEX_TIMEOUT_MS` defaults to `300000`.

## Storefront invariants

The template tests protect the commerce facts Codex must preserve:

- Price: `$42.00`
- SKU: `RMT-001`
- Inventory: `3`
- Cart API returns the same SKU, quantity, and unit price
