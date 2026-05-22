#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

function help() {
	console.log(`Promo Studio Pi doctor

Usage: npm run pi:doctor

Checks that the pi CLI is available for JSON harness runs.

Exit codes:
  0  pi CLI responds
  1  pi CLI missing or failed`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

const result = spawnSync("pi", ["--version"], { encoding: "utf8" });
if (result.status !== 0) {
	console.error("pi CLI is not available on PATH.");
	console.error(result.stderr || result.stdout);
	process.exit(1);
}

console.log(`OK pi CLI: ${(result.stdout || result.stderr).trim()}`);
process.exit(0);
