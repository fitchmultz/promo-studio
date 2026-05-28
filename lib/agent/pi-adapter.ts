import { mkdir } from "node:fs/promises";
import { paths, piChildEnv, redactSecrets } from "@/lib/config";
import { runProcess } from "@/lib/agent/process";
import type { VariantProcessRunner } from "@/lib/agent/types";

export interface PiJsonArgsOptions {
	sessionId?: string;
	sessionDir?: string;
}

/** Pi subprocess: JSON event stream, prompt on stdin (no -p; that flag is print-mode only). */
export function piJsonArgs(
	requestedModel: string,
	options: PiJsonArgsOptions = {},
): string[] {
	const args = ["--mode", "json"];
	if (options.sessionId) {
		args.push("--session-id", options.sessionId);
		args.push("--session-dir", options.sessionDir ?? paths.piSessions);
	} else {
		args.push("--no-session");
	}
	if (requestedModel) args.push("--model", requestedModel);
	return args;
}

export async function runPiRuntime(params: {
	input: string;
	processRunner: VariantProcessRunner;
	requestedModel: string;
	runId: string;
	workspace: string;
	timeoutMs: number;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}) {
	await mkdir(paths.piSessions, { recursive: true });
	const result = await params.processRunner(
		"pi",
		piJsonArgs(params.requestedModel, { sessionId: params.runId }),
		{
			cwd: params.workspace,
			env: piChildEnv(),
			input: params.input,
			timeoutMs: params.timeoutMs,
			onStdoutLine: params.onStdoutLine,
			onStderrLine: params.onStderrLine,
		},
	);
	if (result.code !== 0 && result.stderr.trim()) {
		return { ...result, stderr: redactSecrets(result.stderr.trim()) };
	}
	return result;
}

export { runProcess as runPiProcess };
