#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

function help() {
	console.log(`Promo Studio Codex check

Usage: npm run codex:check

Verifies that the codex CLI is available on PATH.

Exit codes:
  0  Codex CLI is available or help shown
  1  Codex CLI is missing`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

const result = spawnSync("codex", ["--version"], { encoding: "utf8" });
if (result.status !== 0) {
	console.error(
		"Codex CLI was not found. Install and authenticate Codex before running live variants.",
	);
	process.exit(1);
}
console.log(`Codex CLI available: ${(result.stdout || result.stderr).trim()}`);
