# Pi Integration

Promo Studio Pi can run the same commerce task through the Pi coding agent harness.

## SDK path (`AGENT_CORE=pi`, `AGENT_HARNESS=sdk`)

- Uses `createAgentSession({ cwd: workspace, model, thinkingLevel })`.
- Streams `AgentSessionEvent` objects as JSONL transcript lines.
- Isolation is the copied workspace plus `cwd`; there is no Codex-style sandbox flag.
- Requires provider API keys in Pi auth storage or env (`ANTHROPIC_API_KEY`, etc.).

## JSON CLI path (`AGENT_HARNESS=json`)

```bash
pi --mode json --no-session --model openai-codex/gpt-5.5:low -p -
```

- Prompt is sent on stdin; stdout is JSONL (see Pi `docs/json.md`).
- Subprocess `cwd` is the isolated storefront workspace.

## Model format (`PI_MODEL` only)

- `provider/model` — e.g. `openai-codex/gpt-5.5`
- `provider/model:thinking` — e.g. `openai-codex/gpt-5.5:low` (matches `pi --model`)
- `pi-default` (form) or empty `PI_MODEL` uses the first available model from `ModelRegistry`

## Doctor

```bash
npm run pi:doctor
```
