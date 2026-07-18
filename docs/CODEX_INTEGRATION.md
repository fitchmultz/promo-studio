# Codex integration

> **Multi-agent context:** Promo Studio supports Codex, Pi, and Cursor SDK on the same runner and receipt pipeline. This document covers **Codex only**. Start with [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for the shared architecture.

Promo Studio uses Codex as an autonomous code agent, not as a text completion API. When `agentCore=codex`, the default harness is the official TypeScript SDK from `@openai/codex-sdk`; `codex exec` is the preserved CLI fallback.

## Current SDK contract

Reviewed for `@openai/codex-sdk@0.144.5` / bundled `@openai/codex`:

- The TypeScript SDK wraps the version-matched `@openai/codex` CLI and exchanges JSONL events over stdin/stdout.
- `runStreamed()` is the right API for host apps that need live tool, file, command, and usage events.
- `startThread()` owns workspace controls such as `workingDirectory`, `sandboxMode`, `skipGitRepoCheck`, `model`, `modelReasoningEffort`, `approvalPolicy`, `networkAccessEnabled`, and `webSearchMode`.
- The SDK resolves its bundled native CLI from `@openai/codex` optional dependencies. Promo Studio does not pass `codexPathOverride`; that option is reserved for custom binary probes.
- Supplying `env` to `new Codex()` disables broad process-env inheritance. Promo Studio passes a deliberately small child environment and only includes subscription auth state or API-key credentials according to the selected auth mode.

The upstream `0.144.5` SDK type surface does not require a TypeScript SDK migration for this app. Promo Studio does not select Codex profiles and instead sends explicit per-run SDK/thread options.

## Current exec contract

Reviewed for the bundled Codex CLI from `@openai/codex-sdk@0.144.5` using the current non-interactive mode documentation and CLI reference:

- `codex exec` is the stable non-interactive CLI surface for scripted runs.
- `--json` is the documented machine-readable mode and emits JSONL events such as `thread.started`, `turn.started`, `item.*`, `turn.completed`, `turn.failed`, and `error`.
- `--full-auto` is deprecated; new automation should use explicit sandbox and approval settings.
- `--ephemeral`, `--ignore-user-config`, and `--ignore-rules` are stable exec flags for controlled automation.
- `CODEX_API_KEY` is supported for `codex exec`; Promo Studio passes it only in the child environment for the selected invocation.

## Runtime flow

1. `POST /api/variant-runs` checks auth and same-origin form submission.
2. `lib/workspace.ts` copies `templates/storefront` into `agent-workspaces/run-<id>/storefront`.
3. `lib/variant-prompt.ts` builds a campaign-specific software task.
4. `POST /api/variant-runs` schedules `executeVariantRun()` (via Next.js `after()`), so **Create Variant** starts the selected agent without a separate worker. When the core is Codex, `lib/agent/runner.ts` uses:
   - Default: official TypeScript SDK via `CODEX_RUNTIME=sdk`.
   - Fallback: direct CLI execution via `CODEX_RUNTIME=exec`.
   - Optional: `npm run runs:worker` drains stuck `queued` rows only.
5. Runtime events are normalized into JSONL transcript lines and stored on the `VariantRun` row.
6. The agent must edit source files, run `npm test`, run `npm run build`, and write `artifact/manifest.json`.
7. The host runner validates the manifest against detected workspace changes, inlines the built preview, and finalizes the run status.
8. `/runs/<id>` and `/proof` render the persisted receipt.

## Runtime contracts

The SDK path starts a streamed Codex turn with explicit automation controls:

```text
Codex TypeScript SDK runStreamed workingDirectory=<workspace> sandboxMode=workspace-write skipGitRepoCheck=true approvalPolicy=never networkAccessEnabled=false webSearchMode=disabled model=<model> modelReasoningEffort=<effort>
```

Those controls keep hosted runs non-interactive and deterministic:

- `approvalPolicy=never` prevents approval prompts from blocking queue workers.
- `sandboxMode=workspace-write` confines writes to the isolated storefront workspace.
- `networkAccessEnabled=false` keeps generated variants from depending on live network access.
- `webSearchMode=disabled` keeps campaign execution bound to the local prompt and product facts.

The preserved exec fallback follows the current `codex exec` non-interactive guidance for scripted runs:

```bash
codex exec --json --ephemeral --ignore-user-config --ignore-rules \
  --sandbox workspace-write \
  --skip-git-repo-check \
  --cd <workspace> \
  -c approval_policy="never" \
  -c sandbox_workspace_write.network_access=false \
  -c web_search="disabled" \
  -m <model> \
  -c model_reasoning_effort="<effort>" \
  -
```

Exec-specific controls:

- `--json` emits JSONL events that Promo Studio can persist as the run transcript.
- `--ephemeral` avoids writing Codex session rollout files for one-off storefront variants.
- `--ignore-user-config` prevents `$CODEX_HOME/config.toml` from changing hosted automation behavior; authentication still uses `CODEX_HOME`.
- `--ignore-rules` prevents user or project execpolicy `.rules` files from changing the controlled run policy.
- The trailing `-` forces Codex to read the generated campaign task from stdin.

Both runtimes use the same prompt, workspace, auth selection, timeout, transcript persistence, manifest validation, changed-file detection, preview inlining, and final receipt fields.

## Auth handling

Promo Studio supports subscription auth and API-key auth without exposing broad host environment state:

- Subscription mode passes `HOME` and optional `CODEX_HOME` so Codex can find existing login state.
- API-key mode passes only the selected API key as `CODEX_API_KEY`; `OPENAI_API_KEY` is accepted as a fallback source and remapped before the child process starts.
- `auto` mode tries subscription auth first, then falls back to API-key mode only when the first run fails with an auth-shaped error and an API key exists.
- Secrets are redacted before transcript, stdout, stderr, and receipt persistence.

## Timeout and event handling

The SDK runner uses `runStreamed()` with an `AbortSignal` tied to `CODEX_TIMEOUT_MS`. Every structured event is serialized as one redacted JSONL line. `turn.failed` and top-level `error` events are treated as failed process results so the harness-neutral runner can reuse the same validation/finalization path as subprocess runtimes.

The transcript includes the SDK `thread.started` event when Codex emits it. Promo Studio treats threads as single-run execution records and does not resume them later.

## Sandbox and isolation

Codex always runs in `workspace-write` with its working directory set to the isolated storefront copy. The host Next.js app and template source remain outside the writable workspace. Workspaces copy the template files except ignored generated/dependency artifacts (`node_modules`, `dist`, `.DS_Store`) and resolve template tooling from the repository root `node_modules`.

## Doctor command

`npm run codex:doctor` checks the storefront template, the installed SDK/CLI packages, version match, SDK native CLI resolver, and the documented `codex exec` automation flags. It also prints auth and exec-fallback setup hints without requiring live Codex credentials.

## Required receipt

`artifact/manifest.json` must include:

```json
{
  "summary": "one sentence summary",
  "changedFiles": ["src/ProductPage.tsx"],
  "commandsRun": ["npm test", "npm run build"],
  "testsPassed": true,
  "buildPassed": true,
  "commerceInvariantsPreserved": true,
  "previewPath": "dist/index.html"
}
```

The app also stores runtime, invocation shape, selected auth mode, selected model, selected reasoning effort, prompt, transcript, stdout, stderr, validation result, changed files, and preview HTML.
