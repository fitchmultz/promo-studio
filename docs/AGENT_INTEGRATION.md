# Agent Integration

Promo Studio runs storefront variants through a swappable agent core. The host app, workspace copy, prompt, manifest validation, and receipt UI are harness-agnostic.

## Runtime flow

1. `POST /api/variant-runs` checks auth and same-origin form submission.
2. `resolveAgentFromForm()` returns the canonical discriminated `AgentRuntimeSpec` for core, harness, model, and effort/thinking.
3. `lib/workspace.ts` copies `templates/storefront` into `agent-workspaces/run-<id>/storefront` and creates a queued `VariantRun` row.
4. `npm run runs:worker` calls `drainQueuedVariantRunQueue()`, which claims queued rows before invoking the selected adapter:
   - **Codex SDK** — `@openai/codex-sdk` streamed JSONL with explicit non-interactive automation controls
   - **Codex exec** — `codex exec --json` subprocess with mirrored sandbox/config controls
   - **Pi** — `pi --mode json --session-id <run-id> --session-dir artifacts/pi-sessions` subprocess (prompt on stdin)
5. Events are persisted as JSONL on `VariantRun.transcript`.
6. The agent must edit source, run `npm test`, `npm run build`, and write `artifact/manifest.json`.
7. The queued runner validates the manifest against real detected source changes, inlines the built preview, and finalizes the receipt. Stale `running` rows are failed during queue recovery.

## Dependency boundary

Run `npm install` once at the repository root. `agent-workspaces/run-<id>/storefront` copies the template files except ignored generated/dependency artifacts (`node_modules`, `dist`, `.DS_Store`) and resolves Vite/Vitest/React tooling from the root `node_modules`.

Codex runs are intentionally non-interactive and local: `approvalPolicy=never`, `workspace-write`, `networkAccessEnabled=false`, and `webSearchMode=disabled`. The same policy is reflected in the SDK invocation receipt and the `codex exec` fallback config flags.

## Configuration

See `.env.example`. Defaults:

- `AGENT_CORE=codex`
- `CODEX_RUNTIME=sdk`
- `PI_MODEL=` is blank by default; set it to a Pi model ref such as `cursor/composer-2.5` or `openai-codex/gpt-5.5:low` when you want an env default

## Demo matrix

| Core | Harness | Example model |
|------|---------|---------------|
| codex | sdk | `gpt-5.5` |
| codex | exec | `gpt-5.5-mini` |
| pi | json | `cursor/composer-2.5` or `openai-codex/gpt-5.5:low` |

## Docs

- [CODEX_INTEGRATION.md](./CODEX_INTEGRATION.md) — Codex-specific details
- [PI_INTEGRATION.md](./PI_INTEGRATION.md) — Pi-specific details
