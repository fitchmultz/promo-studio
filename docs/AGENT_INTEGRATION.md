# Agent Integration

Promo Studio Pi runs storefront variants through a swappable agent core. The host app, workspace copy, prompt, manifest validation, and receipt UI are harness-agnostic.

## Runtime flow

1. `POST /api/variant-runs` checks auth and same-origin form submission.
2. `resolveAgentFromForm()` picks core, harness, model, and effort/thinking.
3. `lib/workspace.ts` copies `templates/storefront` into `agent-workspaces/run-<id>/storefront`.
4. `lib/agent/runner.ts` invokes the selected adapter:
   - **Codex SDK** — `@openai/codex-sdk` streamed JSONL
   - **Codex exec** — `codex exec --json` subprocess
   - **Pi** — `pi --mode json --no-session` subprocess (prompt on stdin)
5. Events are persisted as JSONL on `VariantRun.transcript`.
6. The agent must edit source, run `npm test`, `npm run build`, and write `artifact/manifest.json`.
7. The runner validates the manifest and inlines the built preview.

## Configuration

See `.env.example`. Defaults:

- `AGENT_CORE=codex`
- `CODEX_RUNTIME=sdk`
- `PI_MODEL=openai-codex/gpt-5.5:low` (optional; form override supported)

## Demo matrix

| Core | Harness | Example model |
|------|---------|---------------|
| codex | sdk | `gpt-5.5` |
| codex | exec | `gpt-5.5-mini` |
| pi | json | `cursor/composer-2.5` or `openai-codex/gpt-5.5:low` |

## Docs

- [CODEX_INTEGRATION.md](./CODEX_INTEGRATION.md) — Codex-specific details
- [PI_INTEGRATION.md](./PI_INTEGRATION.md) — Pi-specific details
