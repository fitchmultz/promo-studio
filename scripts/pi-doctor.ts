#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	normalizePiModel,
	parsePiModelSpec,
	piProjectRoot,
	piSessionsPath,
	PI_CHILD_ENV_KEYS,
	PI_SECRET_ENV_KEYS,
} from "@/lib/pi-runtime-config";
import { listAvailablePiModels } from "@/lib/pi-models";

export const MIN_PI_VERSION = "0.80.2";
export const SUGGESTED_PI_VERSION = "0.80.2";
export const REQUIRED_PI_HELP_FLAGS = [
	"--mode <mode>",
	"--session-id <id>",
	"--session-dir <dir>",
	"--model <pattern>",
] as const;
export const SUGGESTED_PI_HELP_FLAGS = ["--name, -n <name>"] as const;

type SpawnResult = {
	status: number | null;
	stdout?: string | Buffer | null;
	stderr?: string | Buffer | null;
	error?: Error;
};

export type PiDoctorSeverity = "ok" | "warn" | "fail";

export interface PiDoctorCheck {
	label: string;
	severity: PiDoctorSeverity;
	message: string;
}

export interface PiDoctorDeps {
	spawn: (
		command: string,
		args: string[],
		options?: { cwd?: string; encoding?: BufferEncoding },
	) => SpawnResult;
	readFile: (target: string, encoding: BufferEncoding) => string;
	mkdir: (target: string) => void;
	writeFile: (target: string, contents: string) => void;
	rm: (target: string) => void;
	listModels: typeof listAvailablePiModels;
	env: NodeJS.ProcessEnv;
	projectRoot: string;
	sessionDir: string;
}

function help() {
	console.log(`Promo Studio agent doctor (Pi CLI)

Usage: npm run pi:doctor

Checks that the pi CLI and local Pi SDK package are ready for JSON harness runs.

Exit codes:
  0  pi CLI responds and all required automation checks pass
  1  pi CLI missing, too old, missing required flags, or local setup failed`);
}

function ok(label: string, message: string): PiDoctorCheck {
	return { label, severity: "ok", message };
}

function warn(label: string, message: string): PiDoctorCheck {
	return { label, severity: "warn", message };
}

function fail(label: string, message: string): PiDoctorCheck {
	return { label, severity: "fail", message };
}

function outputText(
	value: SpawnResult["stdout"] | SpawnResult["stderr"],
): string {
	if (typeof value === "string") return value;
	if (Buffer.isBuffer(value)) return value.toString("utf8");
	return "";
}

export function parseVersion(version: string) {
	const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!match) return null;
	return match.slice(1).map(Number) as [number, number, number];
}

export function versionAtLeast(version: string, minimum: string) {
	const parsed = parseVersion(version);
	const parsedMinimum = parseVersion(minimum);
	if (!parsed || !parsedMinimum) return false;
	for (let index = 0; index < parsed.length; index += 1) {
		if (parsed[index] > parsedMinimum[index]) return true;
		if (parsed[index] < parsedMinimum[index]) return false;
	}
	return true;
}

export function missingRequiredPiHelpFlags(helpText: string): string[] {
	return REQUIRED_PI_HELP_FLAGS.filter((flag) => !helpText.includes(flag));
}

export function missingSuggestedPiHelpFlags(helpText: string): string[] {
	return SUGGESTED_PI_HELP_FLAGS.filter((flag) => !helpText.includes(flag));
}

export function piModelEnvCheck(rawModel: string | undefined): PiDoctorCheck {
	try {
		const normalized = normalizePiModel(rawModel ?? "");
		if (!normalized)
			return ok("PI_MODEL", "blank; Pi default model selection will be used");
		const spec = parsePiModelSpec(normalized);
		const scope = spec.provider
			? `${spec.provider}/${spec.modelId}`
			: `model pattern ${spec.modelId}`;
		const thinking = spec.thinking ? ` with thinking=${spec.thinking}` : "";
		return ok("PI_MODEL", `${scope}${thinking}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return fail("PI_MODEL", message);
	}
}

function packageVersionCheck(deps: PiDoctorDeps): PiDoctorCheck {
	const packageJsonPath = path.join(
		deps.projectRoot,
		"node_modules",
		"@earendil-works",
		"pi-coding-agent",
		"package.json",
	);
	try {
		const packageJson = JSON.parse(deps.readFile(packageJsonPath, "utf8")) as {
			version?: string;
		};
		const version = packageJson.version ?? "unknown";
		if (!versionAtLeast(version, MIN_PI_VERSION)) {
			return fail(
				"Pi SDK package",
				`@earendil-works/pi-coding-agent ${version} is too old; run npm install after updating package.json`,
			);
		}
		if (!versionAtLeast(version, SUGGESTED_PI_VERSION)) {
			return warn(
				"Pi SDK package",
				`@earendil-works/pi-coding-agent ${version} works for required automation, but ${SUGGESTED_PI_VERSION}+ is recommended for current Pi best practices`,
			);
		}
		return ok("Pi SDK package", `@earendil-works/pi-coding-agent ${version}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return fail(
			"Pi SDK package",
			`could not read ${packageJsonPath}; run npm install (${message})`,
		);
	}
}

function sessionDirCheck(deps: PiDoctorDeps): PiDoctorCheck {
	const marker = path.join(deps.sessionDir, `.pi-doctor-${process.pid}.tmp`);
	try {
		deps.mkdir(deps.sessionDir);
		deps.writeFile(marker, "ok\n");
		deps.rm(marker);
		return ok("Pi session dir", `${deps.sessionDir} is writable`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return fail(
			"Pi session dir",
			`${deps.sessionDir} is not writable (${message})`,
		);
	}
}

function sessionDirIgnoreCheck(deps: PiDoctorDeps): PiDoctorCheck {
	const relativeSessionDir = path.relative(deps.projectRoot, deps.sessionDir);
	if (
		relativeSessionDir.startsWith("..") ||
		path.isAbsolute(relativeSessionDir)
	) {
		return warn(
			"Pi session gitignore",
			`${deps.sessionDir} is outside the project; verify it stays outside storefront diffs`,
		);
	}
	const result = deps.spawn(
		"git",
		["check-ignore", "--quiet", relativeSessionDir],
		{
			cwd: deps.projectRoot,
			encoding: "utf8",
		},
	);
	if (result.status === 0) {
		return ok("Pi session gitignore", `${relativeSessionDir} is ignored`);
	}
	if (result.error) {
		return warn(
			"Pi session gitignore",
			`could not run git check-ignore (${result.error.message})`,
		);
	}
	return fail(
		"Pi session gitignore",
		`${relativeSessionDir} is not ignored; session JSONL must stay out of commits and storefront diffs`,
	);
}

async function modelRegistryCheck(deps: PiDoctorDeps): Promise<PiDoctorCheck> {
	try {
		const result = await deps.listModels();
		const configured = result.models.filter(
			(model) => model.value !== "pi-default",
		);
		if (result.error) {
			return warn("Pi model registry", result.error);
		}
		if (configured.length === 0) {
			return warn(
				"Pi model registry",
				"no auth-configured models reported; extension-backed or manually typed PI_MODEL refs may still work",
			);
		}
		return ok(
			"Pi model registry",
			`${configured.length} auth-configured model${configured.length === 1 ? "" : "s"} available`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return warn("Pi model registry", message);
	}
}

interface PiHelpCheckResult {
	check: PiDoctorCheck;
	helpText?: string;
}

function piCliVersionCheck(deps: PiDoctorDeps): {
	check: PiDoctorCheck;
	version?: string;
} {
	const result = deps.spawn("pi", ["--version"], { encoding: "utf8" });
	if (result.status !== 0) {
		const details = outputText(result.stderr) || outputText(result.stdout);
		return {
			check: fail(
				"Pi CLI",
				`pi CLI is not available on PATH.${details ? ` ${details.trim()}` : ""}`,
			),
		};
	}
	const version = (
		outputText(result.stdout) || outputText(result.stderr)
	).trim();
	if (!versionAtLeast(version, MIN_PI_VERSION)) {
		return {
			check: fail(
				"Pi CLI",
				`pi CLI ${version || "unknown"} is too old; Promo Studio requires v${MIN_PI_VERSION} or newer for Pi automation runs`,
			),
			version,
		};
	}
	if (!versionAtLeast(version, SUGGESTED_PI_VERSION)) {
		return {
			check: warn(
				"Pi CLI",
				`pi CLI ${version} works for required automation, but ${SUGGESTED_PI_VERSION}+ is recommended for current Pi best practices`,
			),
			version,
		};
	}
	return { check: ok("Pi CLI", version), version };
}

function piHelpCheck(deps: PiDoctorDeps): PiHelpCheckResult {
	const result = deps.spawn("pi", ["--help"], { encoding: "utf8" });
	if (result.status !== 0) {
		return {
			check: fail(
				"Pi CLI help",
				"pi --help failed; cannot verify automation flags",
			),
		};
	}
	const helpText = `${outputText(result.stdout)}\n${outputText(result.stderr)}`;
	const missing = missingRequiredPiHelpFlags(helpText);
	if (missing.length > 0) {
		return {
			check: fail(
				"Pi CLI help",
				`missing required automation flag${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
			),
			helpText,
		};
	}
	const missingSuggested = missingSuggestedPiHelpFlags(helpText);
	if (missingSuggested.length > 0) {
		return {
			check: warn(
				"Pi CLI help",
				`required automation flags are present; ${SUGGESTED_PI_VERSION}+ session naming flag not found: ${missingSuggested.join(", ")}`,
			),
			helpText,
		};
	}
	return {
		check: ok(
			"Pi CLI help",
			"JSON mode, explicit sessions, session dir, model flags, and startup session naming are present",
		),
		helpText,
	};
}

export function piHelpEnvironmentVariableNames(helpText: string): string[] {
	const section = helpText.match(
		/Environment Variables:\n(?<body>[\s\S]*?)(?:\n\nBuilt-in Tool Names:|$)/,
	)?.groups?.body;
	if (!section) return [];
	return Array.from(
		new Set(
			[...section.matchAll(/^\s{2,}([A-Z][A-Z0-9_]+)\s+-/gm)].map(
				(match) => match[1],
			),
		),
	).sort();
}

export function piEnvHelpDriftCheck(helpText: string): PiDoctorCheck {
	const helpKeys = piHelpEnvironmentVariableNames(helpText);
	if (helpKeys.length === 0) {
		return warn(
			"Pi env help drift",
			"could not parse Environment Variables section from pi --help",
		);
	}
	const forwardedKeys: string[] = [...PI_CHILD_ENV_KEYS].sort();
	const missing = helpKeys.filter((key) => !forwardedKeys.includes(key));
	const extra = forwardedKeys.filter((key) => !helpKeys.includes(key));
	if (missing.length > 0 || extra.length > 0) {
		const parts = [];
		if (missing.length > 0)
			parts.push(`missing from allowlist: ${missing.join(", ")}`);
		if (extra.length > 0)
			parts.push(`not listed by pi --help: ${extra.join(", ")}`);
		return fail("Pi env help drift", parts.join("; "));
	}
	return ok(
		"Pi env help drift",
		`${helpKeys.length} pi --help environment variable${helpKeys.length === 1 ? "" : "s"} match the forwarded allowlist`,
	);
}

function piChildEnvCheck(deps: PiDoctorDeps): PiDoctorCheck {
	const configured = PI_CHILD_ENV_KEYS.filter((key) => deps.env[key]);
	const secretCount = PI_SECRET_ENV_KEYS.filter((key) => deps.env[key]).length;
	if (configured.length === 0) {
		return warn(
			"Pi child env",
			"no Pi provider or runtime env vars are set; stored Pi auth or extension-backed models are still supported",
		);
	}
	return ok(
		"Pi child env",
		`${configured.length} Pi env var${configured.length === 1 ? "" : "s"} will be forwarded (${secretCount} secret value${secretCount === 1 ? "" : "s"} redacted from errors)`,
	);
}

function defaultDeps(): PiDoctorDeps {
	const projectRoot = piProjectRoot();
	return {
		spawn: (command, args, options) => spawnSync(command, args, options),
		readFile: (target, encoding) => readFileSync(target, encoding),
		mkdir: (target) => mkdirSync(target, { recursive: true }),
		writeFile: (target, contents) => writeFileSync(target, contents),
		rm: (target) => rmSync(target, { force: true }),
		listModels: listAvailablePiModels,
		env: process.env,
		projectRoot,
		sessionDir: piSessionsPath(projectRoot),
	};
}

export async function collectPiDoctorChecks(
	deps: PiDoctorDeps = defaultDeps(),
): Promise<PiDoctorCheck[]> {
	const checks: PiDoctorCheck[] = [];
	const cli = piCliVersionCheck(deps);
	checks.push(cli.check);
	if (cli.check.severity === "fail") return checks;
	const help = piHelpCheck(deps);
	checks.push(help.check);
	if (help.helpText) checks.push(piEnvHelpDriftCheck(help.helpText));
	checks.push(packageVersionCheck(deps));
	checks.push(piModelEnvCheck(deps.env.PI_MODEL));
	checks.push(piChildEnvCheck(deps));
	checks.push(sessionDirCheck(deps));
	checks.push(sessionDirIgnoreCheck(deps));
	checks.push(await modelRegistryCheck(deps));
	return checks;
}

function printChecks(checks: PiDoctorCheck[]) {
	for (const check of checks) {
		const prefix =
			check.severity === "ok"
				? "OK"
				: check.severity === "warn"
					? "WARN"
					: "FAIL";
		const stream = check.severity === "fail" ? console.error : console.log;
		stream(`${prefix} ${check.label}: ${check.message}`);
	}
}

export async function runPiDoctor() {
	if (process.argv.includes("-h") || process.argv.includes("--help")) {
		help();
		return 0;
	}
	const checks = await collectPiDoctorChecks();
	printChecks(checks);
	return checks.some((check) => check.severity === "fail") ? 1 : 0;
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
	process.exit(await runPiDoctor());
}
