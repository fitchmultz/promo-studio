# Sources

Promo Studio is built from local project code and the installed agent harness contracts exercised by this repository. The app is **multi-agent by design**: Codex, Pi, and Cursor SDK share the same runner, workspace, transcript, validation, and receipt surfaces.

## Local source of truth

- [README.md](../README.md) — demo overview, multi-agent setup, flow, validation, and architecture.
- [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) — harness-agnostic runtime flow and demo matrix.
- [CODEX_INTEGRATION.md](./CODEX_INTEGRATION.md) — Codex SDK / `codex exec` contract.
- [PI_INTEGRATION.md](./PI_INTEGRATION.md) — Pi JSON CLI contract.
- [CURSOR_SDK_INTEGRATION.md](./CURSOR_SDK_INTEGRATION.md) — Cursor TypeScript SDK contract.
- [templates/storefront/AGENTS.md](../templates/storefront/AGENTS.md) — rules any agent must follow inside a storefront workspace.
- [templates/storefront/BRAND_RULES.md](../templates/storefront/BRAND_RULES.md) — product and campaign constraints.
- [tests/](../tests/) — executable validation for auth, config, workspace isolation, manifest validation, route behavior, per-harness selection, and runner lifecycle.

## Product data

The seeded product is the Ribbed Market Tote:

- Price: `$42.00`
- SKU: `RMT-001`
- Inventory: `3`
- Features and description are seeded in `prisma/seed.ts` and mirrored in the storefront template.

## Shared run contract

Regardless of agent core:

- Each run gets `agent-workspaces/run-<id>/storefront` (template copy).
- Activity streams as JSONL on `VariantRun.transcript` (plus on-disk `artifacts/transcripts/<id>.jsonl` during live runs).
- The agent must edit source, run `npm test`, `npm run build`, and write `artifact/manifest.json`.
- The host validates manifest fields, commerce invariants, and detected file changes before accepting a variant.

## Codex runtime contract

When `agentCore=codex`, the integration uses `CODEX_RUNTIME=sdk` by default through `@openai/codex-sdk@0.142.3` streamed turns. The SDK path relies on the version-matched `@openai/codex` CLI bundled through the SDK dependency. The preserved `CODEX_RUNTIME=exec` fallback expects `codex exec` to support JSONL output, ephemeral non-interactive runs, ignored user config/rules, `workspace-write` sandboxing, `--skip-git-repo-check`, `--cd`, `-m`, stdin prompt input via `-`, and config overrides for `approval_policy`, `sandbox_workspace_write.network_access`, `web_search`, and `model_reasoning_effort`.

## Pi runtime contract

When `agentCore=pi`, the integration uses `@earendil-works/pi-coding-agent` v0.80.2 or newer for required automation and runs `pi --mode json` as a subprocess. Promo Studio passes the prompt on stdin, sets `--session-id <run-id>`, stores sessions under gitignored `artifacts/pi-sessions`, and forwards only safe runtime plus Pi/provider environment variables to the child process.

## Cursor runtime contract

When `agentCore=cursor`, the integration uses pinned `@cursor/sdk` 1.0.22 with a local agent scoped to the storefront workspace (`Agent.create` + `Agent.send` + `run.stream()`). Promo Studio passes a run-scoped `JsonlLocalAgentStore` under `local.store` so Cursor SDK checkpoint state stays inside `agent-workspaces/run-<id>/.cursor-sdk-store` instead of the caller's global SDK state root. Transcript lines are normalized to the same JSONL activity shape as Codex SDK runs. Live runs require `CURSOR_API_KEY`.
