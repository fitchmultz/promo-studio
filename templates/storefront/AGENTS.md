# Storefront Variant Workspace

## Purpose

Guide agents that are editing the isolated Vite storefront template for the Ribbed Market Tote. The goal is a visibly different campaign variant that preserves commerce behavior and produces a reviewable manifest.

## Repository map

- `src/product.ts` — product facts that variants must preserve.
- `src/cart.ts` — cart API behavior that variants must preserve.
- `src/ProductPage.tsx`, `src/components/`, `src/styles.css`, `src/theme.ts` — normal variant surface.
- `tests/` — storefront and commerce-invariant tests.
- `artifact/manifest.json` — required run receipt written after successful test/build.

## Operating rules

- Read `AGENTS.md`, `BRAND_RULES.md`, `package.json`, source files, styles, and tests before editing.
- Implement the requested campaign as source-code changes, not as prose for the host app.
- Prefer changing layout, copy, sections, styling, design tokens, and added components/tests.
- Stop once the campaign intent is visible, tests pass, build passes, and the manifest is written.

## Setup and commands

Run inside the storefront workspace:

```bash
npm test
npm run build
```

Use `npm install` only when dependencies are missing. Do not add dependencies unless the user explicitly asks and the variant cannot be built with existing React/Vite code.

## Coding conventions

- Keep React components simple, typed, and local to `src/`.
- Preserve accessible headings, alt text, button text, and readable contrast.
- Preserve the full product photo. Do not crop, stretch, filter, replace, or cover the tote image; keep `.product-image img` using `max-width: 100%`, `max-height: 100%`, `min-width: 0`, `min-height: 0`, and `object-fit: contain`.
- Add or update tests when changing behavior that existing tests do not cover.
- Do not edit `dist/`, `node_modules/`, or lockfiles for normal campaign variants.

## Validation and done criteria

Done means:

- `npm test` passes.
- `npm run build` succeeds.
- Product price remains `$42.00` / `42`.
- SKU remains `RMT-001`.
- Inventory remains `3`.
- Cart API returns the same SKU, quantity, and unit price.
- Product image presentation keeps the full tote photo visible with `object-fit: contain`.
- `artifact/manifest.json` exists and truthfully records summary, changed files, commands, pass/fail booleans, commerce invariants, and `previewPath: "dist/index.html"`.

## Planning and large changes

Do not plan a broad redesign. Choose one clear campaign direction, make the smallest coherent set of source edits, then validate.

## Security and side effects

MUST NOT change:

- `src/product.ts` commerce facts.
- `src/cart.ts` cart API behavior.
- `package.json` or `package-lock.json`.
- Files outside the current workspace.

NEVER call external APIs or services from the storefront variant.

## Progress updates and handoff

When handing off, summarize:

- Campaign direction implemented.
- Files changed.
- `npm test` result.
- `npm run build` result.
- Manifest path and preview path.

## Updating this file

Update this file only when storefront-specific invariants, commands, or allowed variant surfaces change. Keep host-app rules in the root `AGENTS.md`.
