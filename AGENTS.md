# AGENTS.md

## Purpose

Promo Studio is a **multi-agent** commerce demo. The host Next.js app creates isolated storefront workspaces, runs a swappable agent core (**Codex**, **Pi**, or **Cursor SDK**), streams normalized activity, validates the generated storefront, and stores an execution receipt. Codex was the first integrated core; Pi and Cursor use the same runner, transcript, and receipt contract.

## Multi-agent layout

```text
lib/agent/runner.ts          ← harness-agnostic queue, execute, validate
lib/agent/codex-adapter.ts   ← Codex SDK + codex exec
lib/agent/pi-adapter.ts      ← pi --mode json
lib/agent/cursor-adapter.ts  ← @cursor/sdk local agent
lib/activity-view.ts         ← routes events to per-core activity mappers
```

## Repository map

- `app/` — Next.js routes for login, studio, run detail, history, proof, and API endpoints.
- `components/` — Campaign form with agent core/harness picker, activity stream, previews, diffs, receipts.
- `lib/agent/` — Runner, adapters, transcript parsing, invocation descriptors, `schedule-variant-run.ts`.
- `lib/workspace.ts` — copies `templates/storefront` into `agent-workspaces/run-<id>/storefront`.
- `templates/storefront/` — Vite storefront template every agent modifies (see `templates/storefront/AGENTS.md`).
- `tests/` — Vitest coverage for Codex, Pi, Cursor harness selection, and shared runner behavior.
- `docs/` — [docs/README.md](docs/README.md) index and per-core integration contracts.

## Agent selection

| Env / form | Values |
|------------|--------|
| `AGENT_CORE` / `agentCore` | `codex` (default), `pi`, `cursor` |
| `agentHarness` (form / stored run) | Codex: `sdk`, `exec` — Pi: `json` — Cursor: `sdk` (`CODEX_RUNTIME` env default for Codex) |
| Codex model / effort | `CODEX_MODEL`, `CODEX_REASONING_EFFORT`, form `model`, `reasoningEffort` |
| Pi model | `PI_MODEL`, form `model` — `provider/model` or `provider/model:thinking` |
| Cursor model | `CURSOR_MODEL`, form `model` — default `composer-2.5-fast` |

Receipts store `agentCore`, `agentHarness`, and legacy `codexRuntime` (`sdk`, `exec`, `json` for Pi CLI, or `cursor-sdk` for Cursor SDK).

## Node

- **Default:** Node 24 (`.node-version` / `mise exec node@24`).
- **Supported:** Node `>=22.19.0 <27` (Pi SDK floor; excludes unsupported Node 27+).

## Dev server

- Default `npm run dev` uses **webpack** (`next dev --webpack`). Turbopack (`npm run dev:turbo`) can idle at very high CPU in this repo layout (parent `Projects/AI` lockfile + agent workspaces).
- `turbopack.root` in `next.config.ts` pins the app root for production builds; do not remove it.
- Generated run artifacts (`agent-workspaces`, `artifacts`) must stay excluded from Next tracing/watch surfaces.

## Operating rules

- Prefer the smallest change that preserves the demo thesis: bounded agent code edits with isolation, validation, and auditability across **all** agent cores.
- Keep harness adapters aligned: same transcript persistence, timeout handling, and failure messages pattern as Codex/Pi/Cursor peers.
- Do not break per-core smoke scripts (`codex:smoke`, `cursor:smoke`); CI uses mocked adapters where live credentials are unavailable.
- **Create Variant** must auto-start agents (`scheduleVariantRunExecution` / API `after()`); do not regress to worker-only execution.
- See [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md) for the shared harness contract and [docs/README.md](docs/README.md) for per-core docs.
