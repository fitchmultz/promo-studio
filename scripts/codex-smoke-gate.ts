#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

function help() {
	console.log(`Promo Studio Codex smoke gate

Usage: npm run codex:smoke

Runs local checks that do not spend a live Codex execution.

Exit codes:
  0  Checks passed or help shown
  1  A check failed`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

for (const args of [
	["run", "codex:check"],
	["run", "codex:doctor"],
]) {
	const result = spawnSync("npm", args, { stdio: "inherit" });
	if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Promo Studio Codex smoke gate passed.");
