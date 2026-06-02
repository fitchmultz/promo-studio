import { redactSecrets, resolveCursorApiKey } from "@/lib/config";
import {
	CursorModelUnavailableError,
	resolveCursorModelSelection,
} from "@/lib/cursor-model-resolve";
import { cursorStreamEventToTranscriptLine } from "@/lib/cursor-transcript";
import { appendLimited } from "@/lib/agent/process";
import {
	cursorAutomationLocalOptions,
	cursorLocalStoreRoot,
	CURSOR_AUTOMATION_MODE,
} from "@/lib/agent/cursor-automation-policy";
import type { ProcessResult, VariantCursorSdkRunner } from "@/lib/agent/types";
import type { Run, SDKAgent } from "@cursor/sdk";

class CursorSdkTimeoutError extends Error {
	constructor() {
		super("Cursor SDK timed out.");
		this.name = "CursorSdkTimeoutError";
	}
}

function cursorTimedOutResult(
	stdout: string,
	stderr = "Cursor SDK timed out.",
) {
	return {
		code: null,
		stdout,
		stderr,
		timedOut: true,
	} satisfies ProcessResult;
}

export const defaultCursorSdkRunner: VariantCursorSdkRunner = async (
	options,
) => {
	const { Agent, CursorAgentError, JsonlLocalAgentStore } = await import(
		"@cursor/sdk"
	);
	const controller = new AbortController();
	let activeRun: Run | undefined;
	let activeAgent: SDKAgent | undefined;
	let rejectTimeout: (error: CursorSdkTimeoutError) => void = () => undefined;
	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		rejectTimeout = reject;
	});
	const timeout = setTimeout(() => {
		controller.abort();
		void activeRun?.cancel().catch(() => undefined);
		void activeAgent?.[Symbol.asyncDispose]().catch(() => undefined);
		rejectTimeout(new CursorSdkTimeoutError());
	}, options.timeoutMs);
	timeout.unref();
	let stdout = "";
	let streamFailure = "";
	const apiKey = resolveCursorApiKey();
	if (!apiKey) {
		const message =
			"CURSOR_API_KEY is required for Cursor SDK storefront variant runs.";
		options.onStderrLine?.(message);
		return { code: 1, stdout: "", stderr: message, timedOut: false };
	}
	try {
		const runPromise = (async () => {
			const model = await resolveCursorModelSelection(
				apiKey,
				options.requestedModel,
			);
			if (controller.signal.aborted) throw new CursorSdkTimeoutError();
			const local = {
				...cursorAutomationLocalOptions(options.workspace),
				store: new JsonlLocalAgentStore(
					cursorLocalStoreRoot(options.workspace),
				),
			};
			activeAgent = await Agent.create({
				apiKey,
				model,
				local,
			});
			try {
				if (controller.signal.aborted) throw new CursorSdkTimeoutError();
				activeRun = await activeAgent.send(options.input, {
					mode: CURSOR_AUTOMATION_MODE,
				});
				for await (const event of activeRun.stream()) {
					if (controller.signal.aborted) break;
					const line = redactSecrets(cursorStreamEventToTranscriptLine(event));
					stdout = appendLimited(stdout, `${line}\n`);
					options.onStdoutLine?.(line);
				}
				if (controller.signal.aborted) {
					if (activeRun.supports("cancel")) {
						await activeRun.cancel().catch(() => undefined);
					}
					throw new CursorSdkTimeoutError();
				}
				const result = await activeRun.wait();
				if (result.status === "error" || result.status === "cancelled") {
					streamFailure = result.result?.trim() || `Run ${result.status}`;
				}
			} finally {
				await activeAgent[Symbol.asyncDispose]();
			}
			if (streamFailure) {
				const message = redactSecrets(streamFailure);
				options.onStderrLine?.(message);
				return { code: 1, stdout, stderr: message, timedOut: false };
			}
			return { code: 0, stdout, stderr: "", timedOut: false };
		})();
		return await Promise.race([runPromise, timeoutPromise]);
	} catch (error) {
		const message = redactSecrets(
			error instanceof Error ? error.message : String(error),
		);
		if (error instanceof CursorSdkTimeoutError || controller.signal.aborted) {
			return cursorTimedOutResult(stdout, message || "Cursor SDK timed out.");
		}
		if (
			error instanceof CursorModelUnavailableError ||
			error instanceof CursorAgentError
		) {
			options.onStderrLine?.(message);
			return { code: 1, stdout, stderr: message, timedOut: false };
		}
		options.onStderrLine?.(message);
		return { code: 1, stdout, stderr: message, timedOut: false };
	} finally {
		clearTimeout(timeout);
	}
};

export async function runCursorRuntime(params: {
	input: string;
	cursorSdkRunner: VariantCursorSdkRunner;
	requestedModel: string;
	workspace: string;
	timeoutMs: number;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}) {
	return params.cursorSdkRunner({
		input: params.input,
		requestedModel: params.requestedModel,
		workspace: params.workspace,
		timeoutMs: params.timeoutMs,
		onStdoutLine: params.onStdoutLine,
		onStderrLine: params.onStderrLine,
	});
}
