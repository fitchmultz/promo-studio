# Pi Integration

Promo Studio runs storefront variants by spawning **`pi --mode json`** in the isolated workspace. The campaign prompt is sent on **stdin** (same as piping into `pi`).

## Invocation

```bash
cd <workspace>
pi --mode json --no-session --model cursor/composer-2.5
# prompt on stdin
```

Extension-only models (e.g. **`cursor/composer-2.5`** via **`pi-cursor-sdk`**) work here. Do **not** use `-p`; that flag is for print mode, not JSON mode.

Stdout is appended line-by-line to `artifacts/transcripts/<run-id>.jsonl` (full JSONL, no in-stream truncation markers). The database keeps a **recent tail** for live polling only; the run detail page and poll API read the on-disk file when present. Subprocess in-memory buffers stay at **120KB** and are not used as the final transcript source.

## Configuration

- Gear → **Pi** core, model field (e.g. `cursor/composer-2.5` or `openai-codex/gpt-5.5:low`)
- Optional env: `AGENT_CORE=pi`, `PI_MODEL=cursor/composer-2.5`
- Model format: `provider/model` or `provider/model:thinking`

## Studio model list

`GET /api/agent/pi-models` lists models from Pi `ModelRegistry` (auth-configured providers). Extension models may be missing from the list; type the ref anyway.

## Doctor

```bash
npm run pi:doctor
```
