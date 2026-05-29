#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { paths } from "../lib/config";

function help() {
	console.log(`Promo Studio agent doctor

Usage: npm run agent:doctor

Checks shared template/workspace inputs for live variant runs (all agent cores).

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
	"\nRun npm run codex:doctor, npm run pi:doctor, and npm run cursor:doctor for harness-specific checks.",
);
process.exit(failed ? 1 : 0);
