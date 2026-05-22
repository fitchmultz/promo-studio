#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { paths } from "../lib/config";

function help() {
	console.log(`Promo Studio agent doctor

Usage: npm run agent:doctor

Checks template, Codex CLI, and Pi CLI inputs for live variant runs.

Exit codes:
  0  Required local inputs exist or help shown
  1  A required input is missing`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

const checks = [
	["storefront template", paths.templateStorefront],
	["workspace root", paths.workspaces],
];

let failed = false;
for (const [label, target] of checks) {
	if (!existsSync(target)) {
		console.error(`Missing ${label}: ${target}`);
		failed = true;
	} else {
		console.log(`OK ${label}: ${target}`);
	}
}

console.log(
	"\nRun npm run codex:doctor and npm run pi:doctor for harness-specific checks.",
);
process.exit(failed ? 1 : 0);
