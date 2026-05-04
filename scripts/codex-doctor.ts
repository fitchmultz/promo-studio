#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { paths } from "../lib/config";

function help() {
	console.log(`Promo Studio Codex doctor

Usage: npm run codex:doctor

Checks local files needed for live Codex storefront variants.

Exit codes:
  0  Required local inputs exist or help shown
  1  A required input is missing`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

const checks = [
	["Storefront template", paths.templateStorefront],
	["Template agent rules", `${paths.templateStorefront}/AGENTS.md`],
	["Template package", `${paths.templateStorefront}/package.json`],
] as const;
let failed = false;
for (const [label, target] of checks) {
	const ok = existsSync(target);
	console.log(`${ok ? "✓" : "✗"} ${label}: ${target}`);
	failed ||= !ok;
}
if (failed) process.exit(1);
