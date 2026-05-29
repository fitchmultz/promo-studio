#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { cursorApiKeyConfigured } from "../lib/config";

function help() {
	console.log(`Promo Studio Cursor SDK smoke gate

Usage: npm run cursor:smoke

Runs local checks that do not spend a live Cursor agent execution.

Exit codes:
  0  Checks passed or help shown
  1  A check failed`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

function run(command: string, args: string[]) {
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", [
	"vitest",
	"run",
	"--run",
	"tests/cursor-sdk-adapter.test.ts",
	"tests/cursor-transcript.test.ts",
	"tests/cursor-model-resolve.test.ts",
	"tests/cursor-activity-view.test.ts",
]);

if (cursorApiKeyConfigured()) {
	run("npm", ["run", "cursor:doctor"]);
} else {
	console.log("SKIP cursor:doctor (CURSOR_API_KEY not configured)");
}

console.log("Promo Studio Cursor SDK smoke gate passed.");
