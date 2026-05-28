# Cursor SDK integration

> **Multi-agent context:** Promo Studio supports Codex, Pi, and Cursor SDK on the same runner and receipt pipeline. This document covers **Cursor only**. Start with [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for the shared architecture.

When `agentCore=cursor`, Promo Studio runs storefront variants through the **Cursor TypeScript SDK** (`@cursor/sdk`) using a local agent scoped to the isolated workspace copy.

## Invocation

`lib/agent/cursor-adapter.ts` calls `Agent.create` with:

- `local.cwd` — `agent-workspaces/run-<id>/storefront`
- `local.sandboxOptions.enabled` — `true`
- `model` — `{ id: "composer-2.5", params: [{ id: "fast", value: "true" }] }` by default (UI label `composer-2.5-fast`)
- `Agent.send(prompt, { mode: "agent" })` — non-interactive agent mode

`run.stream()` yields `SDKMessage` events; each line is normalized and persisted as JSONL on `VariantRun.transcript`, matching the Codex SDK transcript shape used by the activity stream.

## Configuration

| Variable | Purpose |
|----------|---------|
| `AGENT_CORE=cursor` | Default core when creating runs without form overrides |
| `CURSOR_MODEL` | Default model id (default `composer-2.5-fast`) |
| `CURSOR_API_KEY` | Required for live runs |
| `CURSOR_TIMEOUT_MS` | Run timeout (default `300000`) |

Form / stored settings use sentinel `cursor-default` to mean “use env default / composer-2.5-fast”.

## Receipt fields

- `agentCore` — `cursor`
- `agentHarness` — `sdk`
- `codexRuntime` (legacy column name) — `cursor-sdk`

## Doctor and smoke gate

```bash
npm run cursor:doctor   # requires CURSOR_API_KEY; validates key + model list
npm run cursor:smoke    # Vitest cursor harness tests; doctor when key is set
```

`resolveCursorModelSelection` calls `Cursor.models.list()` before each run when the API is reachable and fails fast if the requested model is unavailable (falls back to the parsed selection only when the list call itself fails).

## Demo matrix row

| Core | Harness | Example model |
|------|---------|---------------|
| cursor | sdk | `composer-2.5-fast` |
