#!/usr/bin/env tsx
import { env, paths } from "../lib/config";
import { codexBinEnv, probeCodexExecAutomationFlags } from "./codex-exec-probe";

function help() {
	console.log(`Promo Studio Codex check

Usage: npm run codex:check
       CODEX_RUNTIME=exec npm run codex:check

Verifies that the configured Codex runtime is available without starting a live Codex turn.

Runtime modes:
  sdk   Verify the @openai/codex-sdk package and bundled Codex runtime are resolvable.
  exec  Verify the codex exec CLI and required automation flags are available.

Exit codes:
  0  Configured Codex runtime is available or help shown
  1  Configured Codex runtime is missing`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

function checkExecHelp() {
	const result = probeCodexExecAutomationFlags(paths.projectRoot);
	if (!result.ok) {
		console.error(`Codex exec automation flags unavailable: ${result.detail}`);
		process.exit(1);
	}
	console.log(`Codex exec automation flags available: ${result.detail}.`);
}

if (env.CODEX_RUNTIME === "sdk") {
	try {
		const { Codex } = await import("@openai/codex-sdk");
		new Codex({ env: { PATH: codexBinEnv(paths.projectRoot).PATH ?? "" } });
		console.log("Codex SDK runtime available: @openai/codex-sdk");
	} catch (error) {
		console.error(
			`Codex SDK runtime is unavailable. Install dependencies with npm install. ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
} else {
	checkExecHelp();
}
