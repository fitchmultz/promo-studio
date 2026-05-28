# AGENTS.md

## Purpose

Promo Studio is a commerce demo: the host Next.js app creates isolated storefront workspaces, runs **Codex** (TypeScript SDK or `codex exec`) or **Pi** (`pi --mode json`), streams activity, validates the generated storefront, and stores an execution receipt.

## Repository map

- `app/` — Next.js routes for login, studio, run detail, history, proof, and API endpoints.
- `components/` — Campaign form with agent core/harness picker, activity stream, previews, diffs, receipts.
- `lib/agent/` — Harness-agnostic runner, Codex/Pi adapters, transcript parsing, invocation descriptors.
- `lib/workspace.ts` — copies `templates/storefront` into `agent-workspaces/run-<id>/storefront`.
- `templates/storefront/` — Vite storefront template the agent modifies.
- `tests/` — Vitest coverage including Codex and Pi harness selection.

## Agent selection

| Env / form | Values |
|------------|--------|
| `AGENT_CORE` / `agentCore` | `codex` (default), `pi` |
| `agentHarness` (form / stored run) | Codex: `sdk`, `exec` — Pi: `json` (`CODEX_RUNTIME` env default for Codex) |
| Codex model / effort | `CODEX_MODEL`, `CODEX_REASONING_EFFORT`, form `model`, `reasoningEffort` |
| Pi model | `PI_MODEL`, form `model` — `provider/model` or `provider/model:thinking` |

Receipts store `agentCore`, `agentHarness`, and legacy `codexRuntime` (`sdk`, `exec`, or `json` for Pi CLI).

## Node

- **Default:** Node 24 (`.node-version` / `mise exec node@24`).
- **Supported:** Node `>=22.19.0 <27` (Pi SDK floor; excludes unsupported Node 27+).

## Dev server

- Default `npm run dev` uses **webpack** (`next dev --webpack`). Turbopack (`npm run dev:turbo`) can idle at very high CPU in this repo layout (parent `Projects/AI` lockfile + agent workspaces).
- `turbopack.root` in `next.config.ts` pins the app root for production builds; do not remove it.
- Generated run artifacts (`agent-workspaces`, `artifacts`) must stay excluded from Next tracing/watch surfaces.

## Operating rules

- Prefer the smallest change that preserves the demo thesis: bounded agent code edits with isolation, validation, and auditability.
- Do not break Codex-only smoke scripts; Pi harnesses are optional at runtime but required in CI via mocked adapters.
- See `docs/AGENT_INTEGRATION.md` for harness contracts.
