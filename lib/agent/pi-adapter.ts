import { piChildEnv, redactSecrets } from "@/lib/config";
import { runProcess } from "@/lib/agent/process";
import type { VariantProcessRunner } from "@/lib/agent/types";

/** Pi subprocess: JSON event stream, prompt on stdin (no -p; that flag is print-mode only). */
export function piJsonArgs(requestedModel: string): string[] {
	const args = ["--mode", "json", "--no-session"];
	if (requestedModel) args.push("--model", requestedModel);
	return args;
}

export async function runPiRuntime(params: {
	input: string;
	processRunner: VariantProcessRunner;
	requestedModel: string;
	workspace: string;
	timeoutMs: number;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}) {
	const result = await params.processRunner(
		"pi",
		piJsonArgs(params.requestedModel),
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
		const message = redactSecrets(result.stderr.trim());
		return {
			result: { ...result, stderr: message },
			selection: { selectedMode: "subscription" as const },
		};
	}
	return { result, selection: { selectedMode: "subscription" as const } };
}

export { runProcess as runPiProcess };
