# Promo Studio documentation

Promo Studio is a **multi-agent** commerce demo: one host app, one storefront task, and swappable **Codex**, **Pi**, or **Cursor SDK** harnesses. Every run uses the same workspace copy, JSONL transcript, validation gates, and receipt—only the agent runtime changes.

## Start here

| Doc | Audience |
|-----|----------|
| [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) | Shared runtime flow, configuration, demo matrix |
| [../README.md](../README.md) | Demo overview, setup, architecture map |

## Per-agent harness contracts

| Core | Doc | Harness |
|------|-----|---------|
| Codex | [CODEX_INTEGRATION.md](./CODEX_INTEGRATION.md) | `sdk` (default), `exec` |
| Pi | [PI_INTEGRATION.md](./PI_INTEGRATION.md) | `json` |
| Cursor | [CURSOR_SDK_INTEGRATION.md](./CURSOR_SDK_INTEGRATION.md) | `sdk` |

## Supporting references

- [SOURCES.md](./SOURCES.md) — local source of truth and runtime contracts
- [../AGENTS.md](../AGENTS.md) — repository conventions for coding agents
