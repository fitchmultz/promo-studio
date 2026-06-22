# Pi integration

> **Multi-agent context:** Promo Studio supports Codex, Pi, and Cursor SDK on the same runner and receipt pipeline. This document covers **Pi only**. Start with [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for the shared architecture.

When `agentCore=pi`, Promo Studio runs storefront variants by spawning **`pi --mode json`** in the isolated workspace. The campaign prompt is sent on **stdin** (same as piping into `pi`). JSON CLI mode remains the canonical harness because the agent process stays isolated from the host Next.js process while still streaming Pi session events as JSONL.

## Invocation

```bash
cd <workspace>
pi --mode json --session-id <run-id> --session-dir <repo>/artifacts/pi-sessions --model cursor/composer-2.5
# prompt on stdin
```

Pi v0.76.0 added explicit automation session IDs. Promo Studio uses the variant run ID as `--session-id` and stores Pi session files under gitignored `artifacts/pi-sessions/`, keeping session history deterministic and outside the storefront diff surface. Do **not** use `-p`; that flag is for print mode, not JSON mode.

Pi v0.79.10 is the required floor for local development and Pi automation runs. The doctor fails when the installed CLI or SDK package is below v0.79.10 so local runs match the current package floor.

SDK and RPC were reviewed against the v0.79.10 docs. The SDK is preferred for same-process Node integrations and RPC is preferred for long-lived custom clients, but Promo Studio intentionally keeps Pi in a subprocess for run isolation, CLI extension parity, and a one-shot prompt lifecycle.

Stdout is appended line-by-line to `artifacts/transcripts/<run-id>.jsonl` (full JSONL, no in-stream truncation markers). The database keeps a **recent tail** for live polling only; the run detail page and poll API read the on-disk file when present. Subprocess in-memory buffers stay at **120KB** and are not used as the final transcript source.

## Configuration

- Gear → **Pi** core, model field (e.g. `cursor/composer-2.5`, `openai-codex/gpt-5.5:low`, or a Pi CLI model pattern such as `sonnet:high`)
- Optional env: `AGENT_CORE=pi`, `PI_MODEL=cursor/composer-2.5`
- Model format: any Pi `--model` value is passed through after validation; full `provider/model` or `provider/model:thinking` refs are preferred for deterministic automation, and `:off` is supported for models where thinking should be disabled.
- Environment forwarding: the Pi subprocess receives safe runtime variables (`PATH`, shell/locale/temp values, `HOME`, `PROJECT_ROOT`), Pi-specific variables (`PI_CODING_AGENT_DIR`, `PI_PACKAGE_DIR`, `PI_OFFLINE`, etc.), and provider auth/config variables listed by `pi --help` (Anthropic, Ant Ling, OpenAI/Azure, NVIDIA NIM, Gemini, OpenRouter, AWS Bedrock, and other supported providers). Host app secrets such as `DATABASE_URL` and `SESSION_SECRET` are not forwarded. Provider secret values are redacted from Pi error output.

## Studio model list

`GET /api/agent/pi-models` lists models from Pi `ModelRegistry` (auth-configured providers) and always includes `pi-default`. Extension-backed models (for example **`cursor/composer-2.5`** via **`pi-cursor-sdk`**) may be missing from the list because they are loaded by Pi extensions at CLI startup; type the ref manually when needed.

## Doctor

```bash
npm run pi:doctor
```

The doctor requires Pi CLI v0.79.10 or newer and treats the startup session-name flag as a best-practice warning rather than a hard gate. It also verifies required CLI help flags, checks that the forwarded Pi env allowlist matches the `pi --help` environment section, validates the local `@earendil-works/pi-coding-agent` package version and `PI_MODEL` syntax, checks forwarded Pi environment state, confirms writable/gitignored session storage, and reports model-registry availability warnings.
