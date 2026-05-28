import { spawnSync } from "node:child_process";
import path from "node:path";
import { codexExecRequiredHelpFlags } from "../lib/agent/codex-automation-policy";

export interface CodexExecProbeResult {
	ok: boolean;
	detail: string;
	missingFlags: string[];
	status: number | null;
}

export function codexBinEnv(projectRoot: string): NodeJS.ProcessEnv {
	const localBin = path.join(projectRoot, "node_modules", ".bin");
	return {
		...process.env,
		PATH: [localBin, process.env.PATH].filter(Boolean).join(path.delimiter),
	};
}

export function probeCodexExecAutomationFlags(
	projectRoot: string,
): CodexExecProbeResult {
	const result = spawnSync("codex", ["exec", "--help"], {
		encoding: "utf8",
		env: codexBinEnv(projectRoot),
	});
	if (result.status !== 0) {
		return {
			ok: false,
			detail: (
				result.stderr ||
				result.stdout ||
				"codex exec --help failed"
			).trim(),
			missingFlags: codexExecRequiredHelpFlags(),
			status: result.status,
		};
	}
	const helpText = `${result.stdout}\n${result.stderr}`;
	const requiredFlags = codexExecRequiredHelpFlags();
	const missingFlags = requiredFlags.filter((flag) => !helpText.includes(flag));
	return {
		ok: missingFlags.length === 0,
		detail: missingFlags.length
			? `missing ${missingFlags.join(", ")}`
			: `supports ${requiredFlags.join(", ")}`,
		missingFlags,
		status: result.status,
	};
}
