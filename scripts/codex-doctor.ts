#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	codexChildEnv,
	paths,
	resolveCodexAuthState,
	type CodexAuthState,
} from "../lib/config";
import { probeCodexExecAutomationFlags } from "./codex-exec-probe";

function help() {
	console.log(`Promo Studio Codex doctor

Usage: npm run codex:doctor

Checks local files and packages needed for live Codex storefront variants.

Exit codes:
  0  Required local inputs exist or help shown
  1  A required input is missing`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

let failed = false;

function check(label: string, ok: boolean, detail: string) {
	console.log(`${ok ? "✓" : "✗"} ${label}: ${detail}`);
	failed ||= !ok;
}

function info(label: string, detail: string) {
	console.log(`i ${label}: ${detail}`);
}

function readPackageVersion(packageJsonPath: string) {
	return JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
		version?: string;
	};
}

function toStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
	return Object.fromEntries(
		Object.entries(env).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
}

function resolveCodexSdkPackageGraph() {
	const sdkEntryPath = fileURLToPath(import.meta.resolve("@openai/codex-sdk"));
	const sdkPackageJsonPath = path.join(
		path.dirname(sdkEntryPath),
		"..",
		"package.json",
	);
	const sdkRequire = createRequire(sdkEntryPath);
	return {
		sdkPackageJsonPath,
		cliPackageJsonPath: sdkRequire.resolve("@openai/codex/package.json"),
	};
}

function codexAuthInfo(authState: CodexAuthState) {
	const childEnv = codexChildEnv(authState.childEnvKeySource);
	const authEnvKeys = ["CODEX_API_KEY", "CODEX_HOME", "HOME"].filter(
		(key) => childEnv[key],
	);
	const childEnvSummary = authEnvKeys.length
		? `child env includes ${authEnvKeys.join(", ")}`
		: "child env has no auth-specific variables";
	if (authState.selectedMode === "api-key") {
		return authState.keySource === "none"
			? `API-key mode selected by ${authState.requestedMode}, but no API key is configured; ${childEnvSummary}`
			: `API-key mode selected by ${authState.requestedMode} using ${authState.keySource} as CODEX_API_KEY; ${childEnvSummary}`;
	}
	const subscriptionSource =
		authState.subscriptionAuthSource === "none"
			? "no HOME/CODEX_HOME auth path configured"
			: `auth path from ${authState.subscriptionAuthSource}`;
	const fallback =
		authState.requestedMode === "auto" &&
		authState.apiKeyFallbackSource !== "none"
			? `; API-key fallback available from ${authState.apiKeyFallbackSource}`
			: "";
	return `subscription mode selected by ${authState.requestedMode}; ${subscriptionSource}; ${childEnvSummary}${fallback}`;
}

const requiredFiles = [
	["Storefront template", paths.templateStorefront],
	["Template agent rules", `${paths.templateStorefront}/AGENTS.md`],
	["Template package", `${paths.templateStorefront}/package.json`],
] as const;

for (const [label, target] of requiredFiles) {
	check(label, existsSync(target), target);
}

const authState = resolveCodexAuthState();
let sdkVersion = "";
let cliVersion = "";
try {
	const packageGraph = resolveCodexSdkPackageGraph();
	sdkVersion =
		readPackageVersion(packageGraph.sdkPackageJsonPath).version ?? "unknown";
	cliVersion =
		readPackageVersion(packageGraph.cliPackageJsonPath).version ?? "unknown";
	check("Codex SDK package", true, `@openai/codex-sdk ${sdkVersion}`);
	check("Codex SDK-owned CLI package", true, `@openai/codex ${cliVersion}`);
	check(
		"Codex SDK/CLI version match",
		sdkVersion === cliVersion,
		`${sdkVersion} / ${cliVersion}`,
	);
} catch (error) {
	check(
		"Codex SDK package graph",
		false,
		`install dependencies with npm install (${error instanceof Error ? error.message : String(error)})`,
	);
}

try {
	const { Codex } = await import("@openai/codex-sdk");
	new Codex({ env: toStringEnv(codexChildEnv(authState.childEnvKeySource)) });
	check(
		"Codex SDK native CLI resolver",
		true,
		"version-matched native binary resolved from @openai/codex optional dependencies",
	);
} catch (error) {
	check(
		"Codex SDK native CLI resolver",
		false,
		`reinstall dependencies so @openai/codex optional native packages are present (${error instanceof Error ? error.message : String(error)})`,
	);
}

const localBin = path.join(paths.projectRoot, "node_modules", ".bin");
const pathEntries = (process.env.PATH ?? "").split(path.delimiter);
if (pathEntries.includes(localBin)) {
	info("codex exec fallback", `PATH includes ${localBin}`);
} else {
	info(
		"codex exec fallback",
		`npm run adds ${localBin} to PATH; use npm scripts for live exec fallback runs`,
	);
}

const execProbe = probeCodexExecAutomationFlags(paths.projectRoot);
check("Codex exec automation flags", execProbe.ok, execProbe.detail);

info("Codex auth", codexAuthInfo(authState));

if (failed) process.exit(1);
