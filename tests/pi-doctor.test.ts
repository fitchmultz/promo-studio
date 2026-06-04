import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PI_CHILD_ENV_KEYS } from "@/lib/pi-runtime-config";
import {
	collectPiDoctorChecks,
	missingRequiredPiHelpFlags,
	missingSuggestedPiHelpFlags,
	piEnvHelpDriftCheck,
	piHelpEnvironmentVariableNames,
	piModelEnvCheck,
	REQUIRED_PI_HELP_FLAGS,
	SUGGESTED_PI_HELP_FLAGS,
	SUGGESTED_PI_VERSION,
	versionAtLeast,
	type PiDoctorDeps,
} from "@/scripts/pi-doctor";

function piHelpText(envKeys: readonly string[] = PI_CHILD_ENV_KEYS) {
	return `${REQUIRED_PI_HELP_FLAGS.join("\n")}\n${SUGGESTED_PI_HELP_FLAGS.join("\n")}\n\nEnvironment Variables:\n${envKeys
		.map((key) => `  ${key} - test variable`)
		.join("\n")}\n\nBuilt-in Tool Names:\n  read - test tool`;
}

function baseDeps(overrides: Partial<PiDoctorDeps> = {}): PiDoctorDeps {
	return {
		spawn: (_command, args) => {
			if (args[0] === "--version")
				return { status: 0, stdout: SUGGESTED_PI_VERSION };
			if (args[0] === "--help") {
				return { status: 0, stdout: piHelpText() };
			}
			if (args[0] === "check-ignore") return { status: 0, stdout: "" };
			return { status: 1, stderr: "unexpected command" };
		},
		readFile: () => JSON.stringify({ version: SUGGESTED_PI_VERSION }),
		mkdir: () => undefined,
		writeFile: () => undefined,
		rm: () => undefined,
		listModels: async () => ({
			models: [
				{ value: "pi-default", label: "Default", provider: "" },
				{
					value: "anthropic/claude-sonnet-4-20250514",
					label: "anthropic/claude-sonnet-4-20250514",
					provider: "anthropic",
				},
			],
		}),
		env: {
			...process.env,
			PI_MODEL: "sonnet:high",
			GEMINI_API_KEY: "gemini-test-key-value",
		},
		projectRoot: "/repo",
		sessionDir: "/repo/artifacts/pi-sessions",
		...overrides,
	};
}

describe("pi doctor", () => {
	it("compares semver-style Pi CLI versions", () => {
		expect(versionAtLeast("0.76.0", "0.76.0")).toBe(true);
		expect(versionAtLeast("0.77.0", "0.76.0")).toBe(true);
		expect(versionAtLeast("0.75.9", "0.76.0")).toBe(false);
		expect(versionAtLeast("not-a-version", "0.76.0")).toBe(false);
	});

	it("reports missing required automation help flags", () => {
		expect(
			missingRequiredPiHelpFlags("--mode <mode>\n--session-id <id>"),
		).toEqual(["--session-dir <dir>", "--model <pattern>"]);
	});

	it("reports missing suggested Pi best-practice help flags", () => {
		expect(missingSuggestedPiHelpFlags(piHelpText())).toEqual([]);
		expect(
			missingSuggestedPiHelpFlags(REQUIRED_PI_HELP_FLAGS.join("\n")),
		).toEqual(["--name, -n <name>"]);
	});

	it("parses the Pi help environment section", () => {
		expect(piHelpEnvironmentVariableNames(piHelpText())).toEqual(
			[...PI_CHILD_ENV_KEYS].sort(),
		);
	});

	it("reports Pi help environment drift", () => {
		expect(
			piEnvHelpDriftCheck(piHelpText([...PI_CHILD_ENV_KEYS, "NEW_PI_API_KEY"])),
		).toMatchObject({
			label: "Pi env help drift",
			severity: "fail",
		});
	});

	it("accepts Pi CLI model patterns and thinking=off in PI_MODEL", () => {
		expect(piModelEnvCheck("sonnet:high")).toMatchObject({
			severity: "ok",
			message: "model pattern sonnet with thinking=high",
		});
		expect(piModelEnvCheck("openai/gpt-5.5:off")).toMatchObject({
			severity: "ok",
			message: "openai/gpt-5.5 with thinking=off",
		});
		expect(piModelEnvCheck("gpt;rm-rf")).toMatchObject({
			severity: "fail",
		});
	});

	it("collects actionable local setup checks", async () => {
		const checks = await collectPiDoctorChecks(baseDeps());

		expect(checks.some((check) => check.severity === "fail")).toBe(false);
		expect(checks.map((check) => check.label)).toEqual([
			"Pi CLI",
			"Pi CLI help",
			"Pi env help drift",
			"Pi SDK package",
			"PI_MODEL",
			"Pi child env",
			"Pi session dir",
			"Pi session gitignore",
			"Pi model registry",
		]);
	});

	it("prints help even when unrelated host app env is invalid", () => {
		const tsxBin = path.join(
			process.cwd(),
			"node_modules",
			".bin",
			process.platform === "win32" ? "tsx.cmd" : "tsx",
		);
		const result = spawnSync(tsxBin, ["scripts/pi-doctor.ts", "--help"], {
			env: { ...process.env, SESSION_SECRET: "short" },
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Usage: npm run pi:doctor");
		expect(result.stderr).not.toContain("ZodError");
	});

	it("stops after a missing Pi CLI failure", async () => {
		const checks = await collectPiDoctorChecks(
			baseDeps({
				spawn: () => ({ status: 1, stderr: "not found" }),
			}),
		);

		expect(checks).toEqual([
			expect.objectContaining({
				label: "Pi CLI",
				severity: "fail",
			}),
		]);
	});
});
