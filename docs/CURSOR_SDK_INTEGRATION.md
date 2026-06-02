# Cursor SDK integration

> **Multi-agent context:** Promo Studio supports Codex, Pi, and Cursor SDK on the same runner and receipt pipeline. This document covers **Cursor only**. Start with [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for the shared architecture.

When `agentCore=cursor`, Promo Studio runs storefront variants through the **Cursor TypeScript SDK** (`@cursor/sdk` 1.0.17, pinned exactly) using a local agent scoped to the isolated workspace copy.

## Invocation

`lib/agent/cursor-adapter.ts` calls `Agent.create` with:

- `local.cwd` — `agent-workspaces/run-<id>/storefront`
- `local.sandboxOptions.enabled` — `true`
- `local.store` — a run-scoped `new JsonlLocalAgentStore("agent-workspaces/run-<id>/.cursor-sdk-store")`
- `model` — `{ id: "composer-2.5", params: [{ id: "fast", value: "true" }] }` by default (UI label `composer-2.5-fast`)
- `Agent.send(prompt, { mode: "agent" })` — non-interactive agent mode

`run.stream()` yields `SDKMessage` events; each line is normalized and persisted as JSONL on `VariantRun.transcript`, matching the Codex SDK transcript shape used by the activity stream. The SDK-local conversation/checkpoint store is kept beside the generated workspace so one-shot demo runs do not write agent state into the caller's global Cursor SDK SQLite store.

## @cursor/sdk 1.0.17 changes incorporated

Evidence reviewed: npm registry metadata for `@cursor/sdk@1.0.17`, the Cursor Explore SDK surface notes, and the current Cursor TypeScript SDK docs at <https://cursor.com/docs/sdk/typescript>.

Observed upstream change inventory through 1.0.17:

- Package metadata and optional native `@cursor/sdk-<platform>` package pins now resolve to `1.0.17`; declared runtime dependencies remain compatible with the existing server-side integration.
- The 1.0.16 local-state APIs remain the relevant surface for Promo Studio: `LocalAgentStore`, `JsonlLocalAgentStore`, `SqliteLocalAgentStore`, pagination helpers, `getDefaultSdkStateRoot`, and `Cursor.configure` / `configureCursorSdk` defaults.
- Local agent create/resume/list/get/run operations accept `store` / `local.store`, so callers can override the default local checkpoint store per call.
- `CursorAgentPlatformOptions` exposes `localStore`, `stateRoot`, `workspaceRef`, and `scopedWorkspaceRef`; direct `AgentOptions.platform` is not part of the public `AgentOptions` type.
- `CursorConfigureOptions.local.useHttp1ForAgent` remains available as a global transport override for local agent streams.
- 1.0.17 adds public run lifecycle/store declaration surfaces (`run-event-notifier-api`, `run-store-public-types`, and vendored shared type declarations). Promo Studio does not need those APIs for one-shot storefront runs.
- SDK docs recommend explicit resource disposal, sandboxing or tool hooks for headless local agents, explicit API keys, and `Cursor.models.list()` for model/parameter discovery.

Promo Studio uses `JsonlLocalAgentStore` per run because it is the applicable SDK feature for this app's isolation/auditability model. Global `Cursor.configure({ local: { store } })` is intentionally not used: runs are independent and should not share conversation state. The HTTP/1 stream override is also not set by default because the current streamed local run path works without a transport workaround.

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
