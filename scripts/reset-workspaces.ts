#!/usr/bin/env tsx
import { resetWorkspaces } from "../lib/workspace";

function help() {
	console.log(`Promo Studio workspace reset

Usage: npm run reset:workspaces

Removes local Codex storefront run workspaces and recreates the workspace root.

Exit codes:
  0  Workspaces reset or help shown
  1  Reset failed`);
}

async function main() {
	if (process.argv.includes("-h") || process.argv.includes("--help")) {
		help();
		return;
	}
	await resetWorkspaces();
	console.log("Promo Studio workspaces reset.");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
