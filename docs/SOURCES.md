# Sources

Promo Studio is built from local project code and the installed Codex SDK/CLI contract exercised by this repository.

## Local source of truth

- `README.md` — demo overview, setup, flow, validation, and architecture.
- `docs/CODEX_INTEGRATION.md` — Codex runtime flow and receipt contract.
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

The integration uses `CODEX_RUNTIME=sdk` by default through `@openai/codex-sdk` streamed turns. The preserved `CODEX_RUNTIME=exec` fallback expects `codex exec` to support JSONL output, `workspace-write` sandboxing, `--skip-git-repo-check`, `--cd`, `-m`, stdin prompt input via `-`, and config overrides with `-c model_reasoning_effort=...`.
