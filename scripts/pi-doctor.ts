#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";

const MIN_PI_VERSION = "0.76.0";

function help() {
	console.log(`Promo Studio agent doctor (Pi CLI)

Usage: npm run pi:doctor

Checks that the pi CLI is available for JSON harness runs.

Exit codes:
  0  pi CLI responds and supports explicit session IDs
  1  pi CLI missing, too old, or failed`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

function parseVersion(version: string) {
	const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!match) return null;
	return match.slice(1).map(Number) as [number, number, number];
}

function versionAtLeast(version: string, minimum: string) {
	const parsed = parseVersion(version);
	const parsedMinimum = parseVersion(minimum);
	if (!parsed || !parsedMinimum) return false;
	for (let index = 0; index < parsed.length; index += 1) {
		if (parsed[index] > parsedMinimum[index]) return true;
		if (parsed[index] < parsedMinimum[index]) return false;
	}
	return true;
}

const result = spawnSync("pi", ["--version"], { encoding: "utf8" });
if (result.status !== 0) {
	console.error("pi CLI is not available on PATH.");
	console.error(result.stderr || result.stdout);
	process.exit(1);
}

const version = (result.stdout || result.stderr).trim();
if (!versionAtLeast(version, MIN_PI_VERSION)) {
	console.error(
		`pi CLI ${version || "unknown"} is too old; Promo Studio requires v${MIN_PI_VERSION} or newer for --session-id automation runs.`,
	);
	process.exit(1);
}

console.log(`OK pi CLI: ${version}`);
process.exit(0);
