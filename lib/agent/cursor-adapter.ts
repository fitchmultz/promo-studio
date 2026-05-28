import { redactSecrets, resolveCursorApiKey } from "@/lib/config";
import {
	CursorModelUnavailableError,
	resolveCursorModelSelection,
} from "@/lib/cursor-model-resolve";
import { cursorStreamEventToTranscriptLine } from "@/lib/cursor-transcript";
import { appendLimited } from "@/lib/agent/process";
import {
	cursorAutomationLocalOptions,
	CURSOR_AUTOMATION_MODE,
} from "@/lib/agent/cursor-automation-policy";
import type { VariantCursorSdkRunner } from "@/lib/agent/types";

export const defaultCursorSdkRunner: VariantCursorSdkRunner = async (
	options,
) => {
	const { Agent, CursorAgentError } = await import("@cursor/sdk");
	const controller = new AbortController();
	let activeRun: Awaited<ReturnType<Awaited<ReturnType<typeof Agent.create>>["send"]>> | undefined;
	const timeout = setTimeout(() => {
		controller.abort();
		void activeRun?.cancel().catch(() => undefined);
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
		const model = await resolveCursorModelSelection(
			apiKey,
			options.requestedModel,
		);
		const agent = await Agent.create({
			apiKey,
			model,
			local: cursorAutomationLocalOptions(options.workspace),
		});
		try {
			activeRun = await agent.send(options.input, {
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
				return {
					code: null,
					stdout,
					stderr: "Cursor SDK timed out.",
					timedOut: true,
				};
			}
			const result = await activeRun.wait();
			if (result.status === "error" || result.status === "cancelled") {
				streamFailure = result.result?.trim() || `Run ${result.status}`;
			}
		} finally {
			await agent[Symbol.asyncDispose]();
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
			return {
				code: null,
				stdout,
				stderr: message || "Cursor SDK timed out.",
				timedOut: true,
			};
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
	const result = await params.cursorSdkRunner({
		input: params.input,
		requestedModel: params.requestedModel,
		workspace: params.workspace,
		timeoutMs: params.timeoutMs,
		onStdoutLine: params.onStdoutLine,
		onStderrLine: params.onStderrLine,
	});
	return {
		result,
		selection: { selectedMode: "subscription" as const },
	};
}
