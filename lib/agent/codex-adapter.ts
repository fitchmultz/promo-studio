import {
	codexChildEnv,
	codexModelArgs,
	codexReasoningArgs,
	redactSecrets,
	selectCodexApiKeyFallbackMode,
	selectCodexMode,
	type CodexAuthMode,
	type CodexReasoningEffort,
	type CodexRuntime,
	type CodexSelection,
} from "@/lib/config";
import {
	codexAutomationExecArgs,
	codexAutomationThreadOptions,
} from "@/lib/agent/codex-automation-policy";
import { appendLimited, runProcess } from "@/lib/agent/process";
import type {
	ProcessResult,
	RuntimeOptions,
	VariantProcessRunner,
	VariantSdkRunner,
} from "@/lib/agent/types";

function codexExecArgs(
	workspace: string,
	requestedModel: string,
	requestedEffort: string,
) {
	return [
		"exec",
		...codexAutomationExecArgs(workspace),
		...codexModelArgs(requestedModel),
		...codexReasoningArgs(requestedEffort),
		"-",
	];
}

function looksLikeAuthFailure(result: ProcessResult) {
	const text = `${result.stdout}\n${result.stderr}`;
	return /(?:\bunauthorized\b|\b401\b|\bcredentials?\b|\bapi[\s_-]*key\b|\blogged\s*in\b|\bnot\s*authenticated\b|\bmust\s*authenticate\b|\bauthentication\s+failed\b|\bnot\s+logged\s+in\b)/i.test(
		text,
	);
}

function toSdkEnv(childEnv: NodeJS.ProcessEnv): Record<string, string> {
	return Object.fromEntries(
		Object.entries(childEnv).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
}

async function runExecRuntime(
	options: RuntimeOptions,
	processRunner: VariantProcessRunner,
) {
	return processRunner(
		"codex",
		codexExecArgs(
			options.workspace,
			options.requestedModel,
			options.requestedEffort,
		),
		{
			cwd: options.workspace,
			env: codexChildEnv(options.keySource),
			input: options.input,
			timeoutMs: options.timeoutMs,
			onStdoutLine: options.onStdoutLine,
			onStderrLine: options.onStderrLine,
		},
	);
}

export const defaultCodexSdkRunner: VariantSdkRunner = async (options) => {
	const { Codex } = await import("@openai/codex-sdk");
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
	timeout.unref();
	let stdout = "";
	let streamFailure = "";
	try {
		const codex = new Codex({
			env: toSdkEnv(codexChildEnv(options.keySource)),
		});
		const thread = codex.startThread({
			...codexAutomationThreadOptions(),
			workingDirectory: options.workspace,
			model: options.requestedModel || undefined,
			modelReasoningEffort: options.requestedEffort || undefined,
		});
		const { events } = await thread.runStreamed(options.input, {
			signal: controller.signal,
		});
		for await (const event of events) {
			const line = redactSecrets(JSON.stringify(event));
			stdout = appendLimited(stdout, `${line}\n`);
			options.onStdoutLine?.(line);
			if (event.type === "turn.failed") streamFailure = event.error.message;
			if (event.type === "error") streamFailure = event.message;
		}
		if (streamFailure) {
			const message = redactSecrets(streamFailure);
			options.onStderrLine?.(message);
			return { code: 1, stdout, stderr: message, timedOut: false };
		}
		return { code: 0, stdout, stderr: "", timedOut: false };
	} catch (error) {
		const message = redactSecrets(
			error instanceof Error ? error.message : String(error),
		);
		if (controller.signal.aborted) {
			return { code: null, stdout, stderr: message, timedOut: true };
		}
		options.onStderrLine?.(message);
		return { code: 1, stdout, stderr: message, timedOut: false };
	} finally {
		clearTimeout(timeout);
	}
};

export async function runCodexWithFallback(params: {
	runtime: CodexRuntime;
	input: string;
	processRunner: VariantProcessRunner;
	sdkRunner: VariantSdkRunner;
	requestedAuthMode: CodexAuthMode;
	requestedModel: string;
	requestedEffort: CodexReasoningEffort | "";
	selection: CodexSelection;
	workspace: string;
	timeoutMs: number;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}) {
	const baseOptions: RuntimeOptions = {
		input: params.input,
		timeoutMs: params.timeoutMs,
		requestedModel: params.requestedModel,
		requestedEffort: params.requestedEffort,
		workspace: params.workspace,
		onStdoutLine: params.onStdoutLine,
		onStderrLine: params.onStderrLine,
		keySource: params.selection.keySource,
	};
	const runRuntime = (keySource: CodexSelection["keySource"]) => {
		const options = { ...baseOptions, keySource };
		return params.runtime === "sdk"
			? params.sdkRunner(options)
			: runExecRuntime(options, params.processRunner);
	};
	let selection = params.selection;
	let result = await runRuntime(selection.keySource);
	if (
		params.requestedAuthMode === "auto" &&
		selection.selectedMode === "subscription" &&
		result.code !== 0 &&
		looksLikeAuthFailure(result)
	) {
		const fallback = selectCodexApiKeyFallbackMode();
		if (fallback.keySource !== "none") {
			selection = fallback;
			result = await runRuntime(selection.keySource);
		}
	}
	return { result, selection };
}

export function resolveCodexSelection(requestedAuthMode: CodexAuthMode) {
	return selectCodexMode(requestedAuthMode);
}

export { runProcess as runCodexProcess };
