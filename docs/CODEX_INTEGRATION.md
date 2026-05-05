# Codex Integration

Promo Studio uses Codex as an autonomous code agent, not as a text completion API.

## Runtime flow

1. `POST /api/variant-runs` checks auth and same-origin form submission.
2. `lib/workspace.ts` copies `templates/storefront` into `codex-workspaces/run-<id>/storefront`.
3. `lib/variant-prompt.ts` builds a campaign-specific software task.
4. `lib/codex-runner.ts` runs Codex through the configured runtime:
   - Default: official TypeScript SDK via `CODEX_RUNTIME=sdk`.
   - Fallback: direct CLI execution via `CODEX_RUNTIME=exec`.
5. Runtime events are normalized into JSONL transcript lines and stored on the `VariantRun` row while Codex runs.
6. Codex must edit source files, run `npm test`, run `npm run build`, and write `artifact/manifest.json`.
7. The runner validates the manifest, detects changed files, inlines the built preview, and updates the run status.
8. `/runs/<id>` and `/proof` render the persisted receipt.

## Runtime contracts

The SDK path starts a streamed Codex turn with:

```text
Codex TypeScript SDK runStreamed workingDirectory=<workspace> sandboxMode=workspace-write skipGitRepoCheck=true model=<model> modelReasoningEffort=<effort>
```

The preserved exec fallback runs:

```bash
codex exec --json --sandbox workspace-write --skip-git-repo-check \
  --cd <workspace> -m <model> -c model_reasoning_effort="<effort>" -
```

Both runtimes use the same prompt, workspace, auth selection, timeout, transcript persistence, manifest validation, changed-file detection, preview inlining, and final receipt fields.

## Sandbox and isolation

Codex always runs in `workspace-write` with its working directory set to the isolated storefront copy. The host Next.js app and template source remain outside the writable workspace.

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
