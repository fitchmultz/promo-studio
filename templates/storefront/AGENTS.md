# Storefront Variant Workspace

You are modifying a product page for the Ribbed Market Tote.

## Immutable Rules
- Do NOT change product price (must remain $42.00)
- Do NOT change SKU (must remain RMT-001)
- Do NOT change inventory count (must remain 3)
- Do NOT modify the cart API or checkout behavior
- Do NOT modify package.json or package-lock.json
- Do NOT call external APIs or services
- Do NOT modify files outside this workspace

## What You CAN Change
- ProductPage.tsx — layout, copy, sections
- theme.ts — colors, fonts, spacing, design tokens
- Add new components in src/components/
- Add new tests in tests/

## Required Actions
1. Read the human-authored source files first: AGENTS.md, BRAND_RULES.md, package.json, src/**/*.ts, src/**/*.tsx, src/**/*.css, and tests/**/*.ts*. Do not read package-lock.json, node_modules, or dist.
2. Implement the requested campaign variant
3. Run `npm test` — all must pass
4. Run `npm run build` — must succeed
5. If anything fails, read the error and fix it
6. Write artifact/manifest.json with: summary, changedFiles, commandsRun, testsPassed, buildPassed, commerceInvariantsPreserved, previewPath
