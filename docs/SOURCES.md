# Sources

Promo Studio is built from local project code and the installed Codex SDK/CLI contract exercised by this repository.

## Local source of truth

- `README.md` — demo overview, setup, flow, validation, and architecture.
- `docs/CODEX_INTEGRATION.md` — Codex runtime flow and receipt contract.
- `docs/PI_INTEGRATION.md` — Pi JSON CLI runtime flow, session, model, environment, and doctor contract.
- `templates/storefront/AGENTS.md` — rules Codex must follow inside a storefront workspace.
- `templates/storefront/BRAND_RULES.md` — product and campaign constraints.
- `tests/` — executable validation for auth, config, workspace isolation, manifest validation, route behavior, and runner lifecycle.

## Product data

The seeded product is the Ribbed Market Tote:

- Price: `$42.00`
- SKU: `RMT-001`
- Inventory: `3`
- Features and description are seeded in `prisma/seed.ts` and mirrored in the storefront template.

## Codex runtime contract

The integration uses `CODEX_RUNTIME=sdk` by default through `@openai/codex-sdk` streamed turns. The SDK path relies on the version-matched `@openai/codex` CLI bundled through the SDK dependency, not a custom `codexPathOverride`. The preserved `CODEX_RUNTIME=exec` fallback expects `codex exec` to support JSONL output, ephemeral non-interactive runs, ignored user config/rules, `workspace-write` sandboxing, `--skip-git-repo-check`, `--cd`, `-m`, stdin prompt input via `-`, and config overrides for `approval_policy`, `sandbox_workspace_write.network_access`, `web_search`, and `model_reasoning_effort`.

## Pi runtime contract

The Pi integration uses `@earendil-works/pi-coding-agent` v0.76.0 or newer and runs `pi --mode json` as a subprocess. Promo Studio passes the prompt on stdin, sets `--session-id <run-id>`, stores sessions under gitignored `artifacts/pi-sessions`, and forwards only safe runtime plus Pi/provider environment variables to the child process. JSON CLI mode is the canonical Pi harness; SDK and RPC are documented alternatives but are not adopted because this demo values process isolation and CLI extension parity.
