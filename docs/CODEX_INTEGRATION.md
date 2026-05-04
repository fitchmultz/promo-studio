# Codex Integration

Promo Studio uses Codex as an autonomous code agent, not as a text completion API.

## Runtime flow

1. `POST /api/variant-runs` checks auth and same-origin form submission.
2. `lib/workspace.ts` copies `templates/storefront` into `codex-workspaces/run-<id>/storefront`.
3. `lib/variant-prompt.ts` builds a campaign-specific software task.
4. `lib/codex-runner.ts` launches:

```bash
codex exec --json --sandbox workspace-write --skip-git-repo-check \
  --cd <workspace> -m <model> -c model_reasoning_effort="<effort>" -
```

5. JSONL stdout is stored on the `VariantRun` row while the process runs.
6. Codex must edit source files, run `npm test`, run `npm run build`, and write `artifact/manifest.json`.
7. The runner validates the manifest, detects changed files, inlines the built preview, and updates the run status.
8. `/runs/<id>` and `/proof` render the persisted receipt.

## Sandbox and isolation

Codex always runs in `workspace-write` with `--cd` set to the isolated storefront copy. The host Next.js app and template source remain outside the writable workspace.

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

The app also stores command shape, selected auth mode, selected model, prompt, transcript, stdout, stderr, validation result, changed files, and preview HTML.
