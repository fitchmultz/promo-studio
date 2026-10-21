# Pi integration

> **Multi-agent context:** Promo Studio supports Codex, Pi, and Cursor SDK on the same runner and receipt pipeline. This document covers **Pi only**. Start with [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for the shared architecture.

When `agentCore=pi`, Promo Studio runs storefront variants through the installed Pi package's **unbundled JSON CLI** in the isolated workspace. The campaign prompt is sent on **stdin** (same as piping into `pi`). JSON CLI mode remains the canonical harness because the agent process stays isolated from the host Next.js process while still streaming Pi session events as JSONL.

## Invocation

```bash
cd <workspace>
node <repo>/node_modules/@earendil-works/pi-coding-agent/dist/cli.js --mode json --session-id <run-id> --session-dir <repo>/artifacts/pi-sessions --model cursor/composer-2.5
# prompt on stdin
```

Pi v0.76.0 added explicit automation session IDs. Promo Studio uses the variant run ID as `--session-id` and stores Pi session files under gitignored `artifacts/pi-sessions/`, keeping session history deterministic and outside the storefront diff surface. Do **not** use `-p`; that flag is for print mode, not JSON mode.

The installed SDK/CLI baseline is Pi **v1.3.0**. `lib/pi-cli.ts` uses Node's package resolver to locate its shipped unbundled `dist/cli.js` and launches it with the host Node executable. The adapter, receipts, and `npm run pi:doctor` share this invocation; they no longer select an unrelated global `pi` on PATH. Pi 1.3.0's npm `pi` bin is bundled with vulnerable undici code that npm overrides cannot patch. The unbundled CLI instead uses the patched external undici 8 dependency (security override `^8.12.3`). This is a temporary package-layout dependency: if upstream stops shipping that file, startup/doctor must fail, not fall back to the vulnerable bundle. Revisit the workaround when an upstream release rebuilds the bin with patched undici. The doctor recommends v1.3.0 while retaining v0.80.10 as the minimum automation-protocol floor; it also checks actual CLI help for environment drift.

For users upgrading existing Pi configuration: v1.0.3 renamed `azure-openai-responses` to `azure`. Update saved model refs, `auth.json`, `models.json`, and related settings keys (the `AZURE_OPENAI_*` environment variables are unchanged). In v1.3.0, custom `kimi-coding` base URLs must include `/v1`. The app does not rewrite users' Pi configuration or persisted receipts.

SDK and RPC were reviewed against the v1.3.0 package/docs. The SDK is preferred for same-process Node integrations and RPC is preferred for long-lived custom clients, but Promo Studio intentionally keeps Pi in a subprocess for run isolation, CLI extension parity, and a one-shot prompt lifecycle. The studio model list uses the async `ModelRuntime` API introduced in v0.80.8.

Stdout is appended line-by-line to `artifacts/transcripts/<run-id>.jsonl` (full JSONL, no in-stream truncation markers). The database keeps a **recent tail** for live polling only; the run detail page and poll API read the on-disk file when present. Subprocess in-memory buffers stay at **120KB** and are not used as the final transcript source.

## Configuration

- Gear → **Pi** core, model field (e.g. `cursor/composer-2.5`, `openai-codex/gpt-5.5:low`, or a Pi CLI model pattern such as `sonnet:high`)
- Optional env: `AGENT_CORE=pi`, `PI_MODEL=cursor/composer-2.5`
- Model format: any Pi `--model` value is passed through after validation; full `provider/model` or `provider/model:thinking` refs are preferred for deterministic automation, and `:off` is supported for models where thinking should be disabled.
- Environment forwarding: the Pi subprocess receives safe runtime variables (`PATH`, shell/locale/temp values, `HOME`, `PROJECT_ROOT`), Pi-specific variables (`PI_CODING_AGENT_DIR`, `PI_PACKAGE_DIR`, `PI_OFFLINE`, etc.), and provider auth/config variables listed by `pi --help` (Anthropic, Ant Ling, OpenAI/Azure, NVIDIA NIM, Gemini, OpenRouter, AWS Bedrock, and other supported providers). Host app secrets such as `DATABASE_URL` and `SESSION_SECRET` are not forwarded. Provider secret values are redacted from Pi error output.

## Studio model list

`GET /api/agent/pi-models` lists auth-configured models through Pi `ModelRuntime` and always includes `pi-default`. The route disables live catalog network refresh so opening Agent settings remains a local, low-latency operation; it uses Pi's built-in, configured, and cached catalogs. Extension-backed models (for example **`cursor/composer-2.5`** via **`pi-cursor-sdk`**) may be missing because they are loaded by Pi extensions at CLI startup; type the ref manually when needed.

## Doctor

```bash
npm run pi:doctor
```

The doctor requires Pi CLI v0.80.10 or newer and treats the startup session-name flag as a best-practice warning rather than a hard gate. It also verifies required CLI help flags, checks that the forwarded Pi env allowlist matches the `pi --help` environment section, validates the local `@earendil-works/pi-coding-agent` package version and `PI_MODEL` syntax, checks forwarded Pi environment state, confirms writable/gitignored session storage, and reports model-runtime availability warnings.
