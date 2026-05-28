# Agent integration

Promo Studio is a **multi-agent** storefront demo. One Next.js host, one campaign prompt, one validation pipeline—and a pluggable **agent core** (Codex, Pi, or Cursor SDK) chosen per run from the studio UI or `.env`.

Everything below the harness layer is shared:

- Isolated workspace copy (`agent-workspaces/run-<id>/storefront`)
- JSONL transcript + live activity stream
- Manifest, tests, build, and commerce-invariant gates
- Receipt, diff, preview, and history

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Promo Studio host (Next.js)                                │
│  studio form → POST /api/variant-runs → executeVariantRun   │
└───────────────────────────┬─────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────────┐
   │  Codex   │      │    Pi    │      │ Cursor SDK   │
   │ sdk/exec │      │   json   │      │     sdk      │
   └────┬─────┘      └────┬─────┘      └──────┬───────┘
        │                 │                    │
        └─────────────────┴────────────────────┘
                            │
                            ▼
              storefront workspace + JSONL transcript
                            │
                            ▼
              validation → preview + receipt
```

Adapters live in `lib/agent/` (`codex-adapter.ts`, `pi-adapter.ts`, `cursor-adapter.ts`). Activity views normalize each harness into the same run UI (`lib/codex-activity-view.ts`, `lib/pi-activity-view.ts`, `lib/cursor-activity-view.ts`).

## Runtime flow

1. `POST /api/variant-runs` checks auth and same-origin form submission.
2. `resolveAgentFromForm()` returns the canonical discriminated `AgentRuntimeSpec` for core, harness, model, and effort/thinking.
3. `lib/workspace.ts` copies `templates/storefront` into `agent-workspaces/run-<id>/storefront` and creates a queued `VariantRun` row.
4. `POST /api/variant-runs` schedules `executeVariantRun()` via Next.js `after()` so agents start when you click **Create Variant** (no separate worker required for local demo). `npm run runs:worker` remains available to drain any stuck `queued` rows. The selected adapter runs:
   - **Codex SDK** — `@openai/codex-sdk` streamed JSONL with explicit non-interactive automation controls
   - **Codex exec** — `codex exec --json` subprocess with mirrored sandbox/config controls
   - **Pi** — `pi --mode json --session-id <run-id> --session-dir artifacts/pi-sessions` subprocess (prompt on stdin)
   - **Cursor SDK** — `@cursor/sdk` local `Agent.create` + `Agent.send` with `cwd` set to the isolated storefront (streamed JSONL transcript)
5. Events are persisted as JSONL on `VariantRun.transcript`.
6. The agent must edit source, run `npm test`, `npm run build`, and write `artifact/manifest.json`.
7. The host runner validates the manifest against real detected source changes, inlines the built preview, and finalizes the receipt. Stale `running` rows are failed during queue recovery.

## Agent cores and harnesses

| Core | Harness | Integration | Typical model |
|------|---------|-------------|---------------|
| `codex` | `sdk` | `@openai/codex-sdk` streamed JSONL | `gpt-5.5` |
| `codex` | `exec` | `codex exec --json` | `gpt-5.5-mini` |
| `pi` | `json` | `pi --mode json` (run-scoped session) | `cursor/composer-2.5` |
| `cursor` | `sdk` | `@cursor/sdk` local agent | `composer-2.5-fast` |

Receipts store `agentCore`, `agentHarness`, and legacy `codexRuntime` (`sdk`, `exec`, `json` for Pi CLI, or `cursor-sdk` for Cursor SDK).

## Dependency boundary

Run `npm install` once at the repository root. `agent-workspaces/run-<id>/storefront` copies the template files except ignored generated/dependency artifacts (`node_modules`, `dist`, `.DS_Store`) and resolves Vite/Vitest/React tooling from the root `node_modules`.

Automation policies are harness-specific but share the same intent: non-interactive local runs inside the workspace sandbox. Codex uses `approvalPolicy=never`, `workspace-write`, `networkAccessEnabled=false`, and `webSearchMode=disabled`. Pi and Cursor run in isolated subprocess / local SDK contexts with comparable storefront-only scope.

## Configuration

See `.env.example`. Defaults:

| Variable | Purpose |
|----------|---------|
| `AGENT_CORE` | Default core: `codex`, `pi`, or `cursor` |
| `CODEX_RUNTIME` | Codex harness when core is codex: `sdk` (default) or `exec` |
| `CODEX_MODEL`, `CODEX_REASONING_EFFORT` | Codex defaults |
| `PI_MODEL` | Pi default model ref (e.g. `cursor/composer-2.5`) |
| `CURSOR_MODEL` | Cursor default (`composer-2.5-fast`) |
| `CURSOR_API_KEY` | Required for live Cursor SDK runs |

Form fields in the studio gear menu override env defaults per run.

## Doctor and smoke scripts

| Command | Checks |
|---------|--------|
| `npm run agent:doctor` | Template + workspace paths (all cores) |
| `npm run codex:doctor` | Codex SDK/CLI |
| `npm run pi:doctor` | Pi CLI + session layout |
| `npm run cursor:doctor` | `CURSOR_API_KEY` + model list |
| `npm run codex:smoke` / `cursor:smoke` | CI-friendly harness unit tests |

## Per-agent deep dives

- [CODEX_INTEGRATION.md](./CODEX_INTEGRATION.md) — Codex SDK and `codex exec`
- [PI_INTEGRATION.md](./PI_INTEGRATION.md) — Pi JSON CLI
- [CURSOR_SDK_INTEGRATION.md](./CURSOR_SDK_INTEGRATION.md) — Cursor TypeScript SDK
