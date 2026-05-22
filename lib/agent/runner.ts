import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Product, User } from "@prisma/client";
import {
	agentTimeoutMs,
	CODEX_DEFAULT_MODEL,
	CODEX_DEFAULT_REASONING_EFFORT,
	type CodexAuthMode,
	type CodexReasoningEffort,
	type CodexRuntime,
	env,
	normalizeCodexModel,
	normalizeCodexReasoningEffort,
	normalizePiModel,
	PI_DEFAULT_MODEL,
	selectedPiThinkingFromModel,
	redactSecrets,
	resolveAgentCore,
	resolveAgentHarness,
	resolveRequestedMode,
	resolveRequestedModel,
	resolveRequestedPiModel,
	resolveRequestedReasoningEffort,
	selectedCodexModel,
	selectedCodexReasoningEffort,
	selectedPiModel,
} from "@/lib/config";
import { prisma } from "@/lib/db";
import {
	defaultCodexSdkRunner,
	resolveCodexSelection,
	runCodexWithFallback,
} from "@/lib/agent/codex-adapter";
import {
	agentSummary,
	buildInvocationDescriptor,
} from "@/lib/agent/invocation";
import { runPiRuntime } from "@/lib/agent/pi-adapter";
import { appendLimited, runProcess } from "@/lib/agent/process";
import type {
	AgentCore,
	AgentHarness,
	ExecuteVariantRunOptions,
	VariantProcessRunner,
	VariantSdkRunner,
} from "@/lib/agent/types";
import { legacyCodexRuntime as toLegacyRuntime } from "@/lib/agent/types";
import {
	parseStoredAgentCore,
	parseStoredAgentHarness,
	parseStoredCodexAuthMode,
} from "@/lib/agent/stored-run";
import {
	isSafeWorkspaceFile,
	readVariantManifest,
	validateVariantReceipt,
} from "@/lib/validation";
import { buildVariantPrompt } from "@/lib/variant-prompt";
import { createVariantWorkspace, detectChangedFiles } from "@/lib/workspace";

export type { VariantProcessRunner, VariantSdkRunner } from "@/lib/agent/types";
export { parseAgentEvents, parseCodexEvents } from "@/lib/agent/transcript";
export { defaultCodexSdkRunner as defaultSdkRunner } from "@/lib/agent/codex-adapter";

async function persistTranscript(runId: string, transcript: string) {
	await prisma.variantRun.update({
		where: { id: runId },
		data: { transcript },
	});
}

function distAssetPath(workspacePath: string, assetPath: string) {
	const relativePath = assetPath.replace(/^\/+/, "");
	if (!isSafeWorkspaceFile(relativePath)) {
		throw new Error(
			`Built preview referenced an unsafe asset path: ${assetPath}`,
		);
	}
	return path.join(workspacePath, "dist", relativePath);
}

async function inlineBuiltPreview(workspacePath: string, previewPath: string) {
	let html = await readFile(path.join(workspacePath, previewPath), "utf8");
	const stylesheetMatches = [
		...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g),
	];
	for (const match of stylesheetMatches) {
		const href = match[1];
		const css = await readFile(distAssetPath(workspacePath, href), "utf8");
		html = html.replace(
			match[0],
			() => `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
		);
	}
	const scriptMatches = [
		...html.matchAll(
			/<script type="module" crossorigin src="([^"]+)"><\/script>/g,
		),
	];
	for (const match of scriptMatches) {
		const src = match[1];
		const js = await readFile(distAssetPath(workspacePath, src), "utf8");
		html = html.replace(
			match[0],
			() =>
				`<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>`,
		);
	}
	return html;
}

function agentFailureMessage(
	core: AgentCore,
	result: {
		code: number | null;
		timedOut: boolean;
	},
) {
	const name = core === "pi" ? "Pi" : "Codex";
	if (result.timedOut) {
		return `${name} timed out before completing the storefront variant.`;
	}
	return `${name} exited with code ${result.code ?? "unknown"}.`;
}

export async function createVariantRun(params: {
	user: User;
	product: Product;
	campaignBrief: string;
	campaignGoal: string;
	requestedAuthMode?: CodexAuthMode;
	requestedModel?: string;
	requestedEffort?: string;
	agentCore?: AgentCore;
	agentHarness?: AgentHarness;
	/** @deprecated Use agentHarness with agentCore=codex */
	runtime?: CodexRuntime;
	runner?: VariantProcessRunner;
	sdkRunner?: VariantSdkRunner;
}) {
	const core = params.agentCore ?? env.AGENT_CORE;
	const harness =
		core === "pi"
			? "json"
			: (params.agentHarness ??
				(params.runtime && core === "codex"
					? params.runtime
					: resolveAgentHarness(null, core)));

	const runId = randomUUID();
	const workspace = await createVariantWorkspace(runId);
	const requestedAuthMode = params.requestedAuthMode ?? env.CODEX_AUTH_MODE;
	const selection = resolveCodexSelection(requestedAuthMode);
	if (
		core === "codex" &&
		selection.selectedMode === "api-key" &&
		selection.keySource === "none"
	) {
		throw new Error(
			"API-key mode requested, but neither CODEX_API_KEY nor OPENAI_API_KEY is configured.",
		);
	}

	let requestedModel: string;
	let selectedModel: string;
	let requestedEffort: string;
	let selectedEffort: string;

	if (core === "pi") {
		requestedModel = normalizePiModel(params.requestedModel ?? env.PI_MODEL);
		selectedModel = selectedPiModel(requestedModel);
		selectedEffort = selectedPiThinkingFromModel(requestedModel);
		requestedEffort = selectedEffort;
	} else {
		requestedModel = normalizeCodexModel(
			params.requestedModel ?? env.CODEX_MODEL,
		);
		selectedModel = selectedCodexModel(requestedModel);
		requestedEffort = normalizeCodexReasoningEffort(
			params.requestedEffort ?? env.CODEX_REASONING_EFFORT,
		);
		selectedEffort = selectedCodexReasoningEffort(requestedEffort);
	}

	const prompt = buildVariantPrompt({
		product: params.product,
		campaignBrief: params.campaignBrief,
		campaignGoal: params.campaignGoal,
	});
	const invocation = buildInvocationDescriptor({
		core,
		harness,
		workspace,
		requestedModel,
		requestedEffort,
		selectedModel,
		selectedEffort,
	});
	const legacyRuntime = toLegacyRuntime(core, harness);

	const runRecord = await prisma.variantRun.create({
		data: {
			id: runId,
			productId: params.product.id,
			userId: params.user.id,
			status: "running",
			campaignBrief: params.campaignBrief,
			campaignGoal: params.campaignGoal,
			workspacePath: workspace,
			requestedAuthMode,
			selectedAuthMode: selection.selectedMode,
			requestedModel:
				core === "pi"
					? requestedModel || PI_DEFAULT_MODEL
					: requestedModel || CODEX_DEFAULT_MODEL,
			selectedModel,
			requestedEffort:
				core === "pi"
					? selectedEffort
					: requestedEffort || CODEX_DEFAULT_REASONING_EFFORT,
			selectedEffort,
			agentCore: core,
			agentHarness: harness,
			codexRuntime: legacyRuntime,
			codexCommand: invocation,
			inputPrompt: prompt,
			outputSummary: agentSummary({ core, selectedModel, selectedEffort }),
		},
	});
	void executeVariantRun(runRecord.id, {
		processRunner: params.runner,
		codexSdkRunner: params.sdkRunner,
	}).catch(() => undefined);
	return runRecord;
}

export async function executeVariantRun(
	runId: string,
	options: ExecuteVariantRunOptions | VariantProcessRunner = {},
) {
	const runRecord = await prisma.variantRun.findUnique({
		where: { id: runId },
	});
	if (!runRecord) throw new Error(`Variant run ${runId} was not found.`);
	const executeOptions =
		typeof options === "function" ? { processRunner: options } : options;
	const processRunner = executeOptions.processRunner ?? runProcess;
	const core = parseStoredAgentCore(runRecord.agentCore);
	const harness =
		core === "pi"
			? "json"
			: parseStoredAgentHarness(runRecord.agentHarness, core);
	const timeoutMs = agentTimeoutMs(core);

	let requestedModel: string;
	let requestedEffort: CodexReasoningEffort | "" = "";
	if (core === "pi") {
		requestedModel =
			runRecord.requestedModel === PI_DEFAULT_MODEL
				? ""
				: runRecord.requestedModel;
		requestedEffort = "";
	} else {
		requestedModel =
			runRecord.requestedModel === CODEX_DEFAULT_MODEL
				? ""
				: runRecord.requestedModel;
		requestedEffort =
			runRecord.requestedEffort === CODEX_DEFAULT_REASONING_EFFORT
				? ""
				: normalizeCodexReasoningEffort(runRecord.requestedEffort);
	}

	const initialSelection = resolveCodexSelection(
		parseStoredCodexAuthMode(runRecord.requestedAuthMode),
	);
	let transcript = runRecord.transcript;
	let transcriptWrite = Promise.resolve();
	let transcriptWriteError: unknown;
	let stderrText = "";
	try {
		const onStdoutLine = (line: string) => {
			transcript = appendLimited(transcript, `${line}\n`);
			transcriptWrite = transcriptWrite
				.then(() => persistTranscript(runId, transcript))
				.catch((error: unknown) => {
					transcriptWriteError ??= error;
				});
		};
		const onStderrLine = (line: string) => {
			stderrText = appendLimited(stderrText, `${line}\n`);
		};

		const agentResult =
			core === "pi"
				? await runPiRuntime({
						input: runRecord.inputPrompt,
						processRunner,
						requestedModel,
						workspace: runRecord.workspacePath,
						timeoutMs,
						onStdoutLine,
						onStderrLine,
					})
				: await runCodexWithFallback({
						runtime: harness === "exec" ? "exec" : "sdk",
						input: runRecord.inputPrompt,
						processRunner,
						sdkRunner: executeOptions.codexSdkRunner ?? defaultCodexSdkRunner,
						requestedAuthMode: parseStoredCodexAuthMode(
							runRecord.requestedAuthMode,
						),
						requestedModel,
						requestedEffort,
						selection: initialSelection,
						workspace: runRecord.workspacePath,
						timeoutMs,
						onStdoutLine,
						onStderrLine,
					});

		const { result, selection } = agentResult;
		transcript = redactSecrets(result.stdout.trim() || transcript.trim());
		stderrText = redactSecrets(result.stderr.trim() || stderrText.trim());
		transcriptWrite = transcriptWrite
			.then(() => persistTranscript(runId, transcript))
			.catch((error: unknown) => {
				transcriptWriteError ??= error;
			});
		await transcriptWrite;
		if (transcriptWriteError) throw transcriptWriteError;
		if (result.code !== 0 || result.timedOut) {
			throw new Error(agentFailureMessage(core, result));
		}
		const manifest = await readVariantManifest(runRecord.workspacePath);
		const detectedChanges = await detectChangedFiles(runRecord.workspacePath);
		const changedFiles = Array.from(
			new Set([...detectedChanges, ...manifest.changedFiles]),
		).sort();
		const validation = validateVariantReceipt(manifest, changedFiles);
		if (!validation.passed) throw new Error(validation.summary);
		const previewHtml = await inlineBuiltPreview(
			runRecord.workspacePath,
			manifest.previewPath,
		);
		return prisma.variantRun.update({
			where: { id: runId },
			data: {
				status: "succeeded",
				selectedAuthMode: selection.selectedMode,
				manifest: JSON.stringify(manifest, null, 2),
				transcript,
				stdout: transcript,
				stderr: stderrText,
				testsPassed: manifest.testsPassed,
				buildPassed: manifest.buildPassed,
				commerceInvariantsOk: manifest.commerceInvariantsPreserved,
				changedFiles: JSON.stringify(changedFiles),
				validationResult: validation.summary,
				outputSummary: manifest.summary,
				previewHtml,
				completedAt: new Date(),
			},
		});
	} catch (error) {
		await transcriptWrite;
		const failure = error ?? transcriptWriteError;
		const message = redactSecrets(
			failure instanceof Error ? failure.message : String(failure),
		);
		const agentName = core === "pi" ? "Pi" : "Codex";
		return prisma.variantRun.update({
			where: { id: runId },
			data: {
				status: "failed",
				transcript,
				stdout: transcript,
				stderr: stderrText,
				error: message,
				validationResult: `Validation: failed\n${message}`,
				outputSummary: `${agentName} did not produce a validated storefront variant.`,
				completedAt: new Date(),
			},
		});
	}
}

/** Resolve agent settings from a form POST for API routes. */
export function resolveAgentFromForm(form: FormData) {
	const core = resolveAgentCore(form);
	return {
		core,
		harness: resolveAgentHarness(form, core),
		requestedAuthMode: resolveRequestedMode(form),
		requestedModel:
			core === "pi"
				? resolveRequestedPiModel(form)
				: resolveRequestedModel(form),
		requestedEffort: core === "pi" ? "" : resolveRequestedReasoningEffort(form),
	};
}
