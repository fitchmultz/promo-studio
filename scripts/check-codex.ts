#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import path from "node:path";
import { env, paths } from "../lib/config";

function help() {
	console.log(`Promo Studio Codex check

Usage: npm run codex:check
       CODEX_RUNTIME=exec npm run codex:check

Verifies that the configured Codex runtime is available without starting a live Codex turn.

Runtime modes:
  sdk   Verify the @openai/codex-sdk package and bundled Codex runtime are resolvable.
  exec  Verify the codex CLI is available on PATH.

Exit codes:
  0  Configured Codex runtime is available or help shown
  1  Configured Codex runtime is missing`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

if (env.CODEX_RUNTIME === "sdk") {
	try {
		const { Codex } = await import("@openai/codex-sdk");
		new Codex({
			codexPathOverride: path.join(
				paths.projectRoot,
				"node_modules",
				"@openai",
				"codex",
				"bin",
				"codex.js",
			),
			env: { PATH: process.env.PATH ?? "" },
		});
		console.log("Codex SDK runtime available: @openai/codex-sdk");
	} catch (error) {
		console.error(
			`Codex SDK runtime is unavailable. Install dependencies with npm install. ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
} else {
	const result = spawnSync("codex", ["--version"], { encoding: "utf8" });
	if (result.status !== 0) {
		console.error(
			"Codex CLI was not found. Install and authenticate Codex before running live variants with CODEX_RUNTIME=exec.",
		);
		process.exit(1);
	}
	console.log(
		`Codex CLI available: ${(result.stdout || result.stderr).trim()}`,
	);
}
