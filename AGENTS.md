# AGENTS.md

## Purpose

Help agents change Promo Studio safely. Promo Studio is a Codex commerce demo: the host Next.js app creates isolated storefront workspaces, runs the Codex TypeScript SDK by default with a preserved `codex exec` fallback, streams activity, validates the generated storefront, and stores an execution receipt.

## Repository map

- `app/` — Next.js routes for login, studio, run detail, history, proof, and API endpoints.
- `components/` — UI for campaign form, activity stream, previews, diffs, run history, and receipts.
- `lib/codex-runner.ts` — Codex SDK/exec runtime launch, JSONL transcript persistence, fallback auth mode, manifest parsing, validation, and preview inlining.
- `lib/workspace.ts` — copies `templates/storefront` into `codex-workspaces/run-<id>/storefront` and detects changed files.
- `lib/validation.ts` — manifest schema, safe-path checks, forbidden changed files, and receipt summary.
- `prisma/` — SQLite schema and seed data for the demo user, product, and seeded run.
- `templates/storefront/` — Vite storefront template that Codex modifies; follow its nested `AGENTS.md` when working there or in generated workspaces.
- `tests/` — Vitest coverage for auth, routes, config, workspace isolation, runner lifecycle, validation, and UI rendering.

## Operating rules

- Prefer the smallest change that satisfies the user-visible outcome and preserves the demo thesis: bounded Codex code edits with isolation, validation, and auditability.
- Proceed without asking when the change is local, reversible, and covered by existing commands. Ask before changing product scope, public positioning, auth/security behavior, data model shape, or dependency set.
- Stop exploring once you have identified the authoritative code path and validation command. Do not add parallel workflows or duplicate sources of truth.
- Keep public-facing language focused on the product workflow. Do not add private process or review context to the public repo.
- Do not edit generated or local-runtime output: `.next/`, `node_modules/`, `dev.db`, `test.db`, `tsconfig.tsbuildinfo`, `codex-workspaces/run-*`, `tmp/`, or built `dist/` directories.

## Setup and commands

Run commands from the repository root unless a nested `AGENTS.md` says otherwise.

```bash
npm install
npm run setup              # reset dev.db, push Prisma schema, generate client, seed demo data
npm run dev                # start the Next.js dev server
npm run typecheck          # next typegen && tsc --noEmit
npm run format:check       # Biome format check
npm run lint               # Biome lint
npm test                   # reset test.db, seed, run Vitest
npm run build              # production Next.js build
npm run validate           # full local gate: setup, seed, typecheck, format, lint, test, build
npm run reset:workspaces   # remove generated Codex workspaces
npm run demo:zip           # zip git-tracked demo files only
```

Use `npm run codex:doctor` for a cheap check that required storefront template inputs exist before live Codex testing.

## Coding conventions

- TypeScript is strict; prefer typed interfaces for component props and public object shapes.
- Match existing server/client boundaries: only components with browser state or effects should use `"use client"`.
- Keep commerce invariants centralized in product data, storefront tests, validation, and receipts. If changing product facts, update tests, seed data, docs, and receipt expectations together.
- If `prisma/schema.prisma` changes, update seed/test expectations and run the relevant setup/test command. This repo uses `prisma db push`, not migration files.
- Dependency changes must use npm and commit the updated `package-lock.json` or nested storefront lockfile.
- For UI changes, preserve accessibility basics already used here: labels, headings, button text, focusable controls, and readable status text.

## Validation and done criteria

Done means:

- The requested behavior is implemented in the authoritative path.
- Relevant docs, tests, seed data, lockfiles, and receipts are updated when affected.
- No generated/local artifacts are included in git.
- Relevant validation passes, or failures are reported with the exact command and blocker.

Validation decision rules:

- Markdown/docs-only changes: verify the file is readable; run `npm run format:check` if practical.
- UI/component or route changes: run `npm run typecheck`, `npm run lint`, and targeted or full `npm test`.
- Codex runner, workspace, validation, auth, Prisma, or config changes: run `npm run validate` unless time/tool limits make that impractical.
- If validation fails, inspect the failure and fix your change. If the failure is unrelated or cannot be fixed safely, report the failing command, error summary, and recommended next step.

## Planning and large changes

Use a short written plan before multi-file or cross-cutting changes. Keep it outcome-oriented: goal, affected paths, validation, risks. Do not create a large planning file unless the task spans multiple sessions or the user asks for one.

## Security and side effects

- Never commit secrets, `.env` files, local databases, generated workspaces, videos, or packaged zips.
- Do not log API keys or unredacted auth material. Preserve existing secret redaction behavior in `lib/config.ts` and `lib/codex-runner.ts`.
- Same-origin and auth checks in API routes are safety boundaries; only relax them with explicit user intent and tests.
- Commands such as `npm run setup`, `npm test`, and `npm run validate` reset local SQLite databases by design. Mention this before running only if the user appears to care about local run data.
- Live Codex runs create `codex-workspaces/run-*` and may take several minutes. Prefer seeded receipts or targeted tests when the task does not require a live run.

## Progress updates and handoff

For multi-step or tool-heavy work, give short progress updates when a phase completes or a command fails. Final handoff should include:

- Files changed.
- Behavior changed.
- Validation commands run and results.
- Known limitations, skipped checks, or follow-up needed.

## Cursor Cloud specific instructions

- **Prisma consent**: All Prisma destructive commands (`npm run setup`, `npm test`, `npm run validate`) require the environment variable `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes"` when run from Cursor. This applies to `db push --force-reset`. The databases are local SQLite files (`dev.db`, `test.db`), so this is always safe in this repo.
- **Environment file**: Copy `.env.example` to `.env` if `.env` does not already exist. No secrets are required for local dev, tests, or the seeded proof flow.
- **Dev server**: `npm run dev` starts Next.js on port 3000. The app redirects unauthenticated requests to `/login`.
- **Demo login**: Email `demo@promostudio.test`, password `promo-studio`.
- **Quick proof path after login**: `/proof` (seeded receipt), `/studio` (campaign form), `/history` (run list), `/runs/seeded-demo-variant` (preview, diff, validation, transcript tabs).
- **Live Codex runs** require `CODEX_API_KEY` or `OPENAI_API_KEY` in `.env`. All other functionality (seeded data, tests, build, proof UI) works without API keys.
- **All validation commands** are documented in the "Setup and commands" section above. Use `npm run validate` for the full gate.

## Updating this file

Update `AGENTS.md` when repo commands, durable constraints, validation gates, or public-demo boundaries change. Keep it concise; put materially different storefront-agent rules in `templates/storefront/AGENTS.md` instead of bloating this root file.
