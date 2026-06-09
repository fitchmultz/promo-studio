import { randomUUID } from "node:crypto";
import type { Product, User } from "@prisma/client";
import {
	agentTimeoutMs,
	type CodexAuthMode,
	redactSecrets,
} from "@/lib/config";
import { prisma } from "@/lib/db";
import { agentDisplayName } from "@/lib/agent/definitions";
import {
	agentSummary,
	buildInvocationDescriptor,
} from "@/lib/agent/invocation";
import { agentRuntimeDefinition } from "@/lib/agent/registry";
import {
	appendLimited,
	MAX_POLL_TRANSCRIPT_CHARS,
	runProcess,
	tailJsonlForPoll,
} from "@/lib/agent/process";
import {
	appendRunTranscriptLine,
	readRunTranscriptFile,
	resolveFullTranscript,
	transcriptBodyForDb,
} from "@/lib/agent/transcript-store";
import type {
	AgentCore,
	AgentHarness,
	ExecuteVariantRunOptions,
	VariantProcessRunner,
} from "@/lib/agent/types";
import type { AgentRuntimeSpec } from "@/lib/agent/types";
import {
	agentRuntimePersistenceFields,
	agentRuntimeSpecFromStoredRun,
	resolveAgentRuntimeSpec,
	resolveAgentRuntimeSpecFromForm,
} from "@/lib/agent/runtime-spec";
import { isUsablePreviewHtml } from "@/lib/preview-quality";
import { inlineBuiltPreview } from "@/lib/storefront-preview";
import { readVariantManifest, validateVariantReceipt } from "@/lib/validation";
import {
	scheduleVariantRunExecution,
	type VariantRunScheduler,
} from "@/lib/agent/schedule-variant-run";
import { buildVariantPrompt } from "@/lib/variant-prompt";
import {
	claimVariantRun,
	drainQueuedVariantRunQueue as drainQueue,
	finalizeVariantRun,
} from "@/lib/variant-run-queue";
import { createVariantWorkspace, detectChangedFiles } from "@/lib/workspace";

export type {
	VariantCursorSdkRunner,
	VariantProcessRunner,
	VariantSdkRunner,
} from "@/lib/agent/types";
export { defaultCodexSdkRunner as defaultSdkRunner } from "@/lib/agent/codex-adapter";
export {
	defaultCursorSdkRunner,
	runCursorRuntime,
} from "@/lib/agent/cursor-adapter";
export { recoverStaleVariantRuns } from "@/lib/variant-run-queue";

async function persistTranscript(runId: string, transcript: string) {
	await prisma.variantRun.update({
		where: { id: runId },
		data: { transcript },
	});
}

function agentFailureMessage(
	core: AgentCore,
	result: {
		code: number | null;
		timedOut: boolean;
	},
	stderr = "",
) {
	const name = agentDisplayName(core);
	if (result.timedOut) {
		return `${name} timed out before completing the storefront variant.`;
	}
	const detail = stderr.trim().split(/\r?\n/).find(Boolean);
	if (detail) return `${name} failed: ${detail}`;
	return `${name} exited with code ${result.code ?? "unknown"}.`;
}

export async function drainQueuedVariantRunQueue(
	options: ExecuteVariantRunOptions = {},
	limit = 5,
) {
	return drainQueue(executeVariantRun, options, limit);
}

export async function createVariantRun(params: {
	user: User;
	product: Product;
	campaignBrief: string;
	campaignGoal: string;
	requestedAuthMode?: CodexAuthMode;
	requestedModel?: string;
	requestedEffort?: string;
	runtimeSpec?: AgentRuntimeSpec;
	agentCore?: AgentCore;
	agentHarness?: AgentHarness;
	/** When true (default), claim and run the agent without blocking the caller. */
	autoExecute?: boolean;
	executeOptions?: ExecuteVariantRunOptions;
	scheduler?: VariantRunScheduler;
}) {
	const runtimeSpec =
		params.runtimeSpec ??
		resolveAgentRuntimeSpec({
			core: params.agentCore,
			harness: params.agentHarness,
			authMode: params.requestedAuthMode,
			model: params.requestedModel,
			effort: params.requestedEffort,
		});
	const runtimeDefinition = agentRuntimeDefinition(runtimeSpec.core);
	runtimeDefinition.validateBeforeCreate?.(runtimeSpec);

	const runId = randomUUID();
	const workspace = await createVariantWorkspace(runId);

	const prompt = buildVariantPrompt({
		product: params.product,
		campaignBrief: params.campaignBrief,
		campaignGoal: params.campaignGoal,
	});
	const invocation = buildInvocationDescriptor({
		core: runtimeSpec.core,
		harness: runtimeSpec.harness,
		runId,
		workspace,
		requestedModel: runtimeSpec.requestedModel,
		requestedEffort: runtimeSpec.requestedEffort,
		selectedModel: runtimeSpec.selectedModel,
		selectedEffort: runtimeSpec.selectedEffort,
	});

	const persistenceFields = agentRuntimePersistenceFields(runtimeSpec);
	const runRecord = await prisma.variantRun.create({
		data: {
			id: runId,
			productId: params.product.id,
			userId: params.user.id,
			status: "queued",
			campaignBrief: params.campaignBrief,
			campaignGoal: params.campaignGoal,
			workspacePath: workspace,
			...persistenceFields,
			codexCommand: invocation,
			inputPrompt: prompt,
			outputSummary: agentSummary(runtimeSpec),
		},
	});
	if (params.autoExecute !== false) {
		scheduleVariantRunExecution(
			runRecord.id,
			executeVariantRun,
			params.executeOptions,
			params.scheduler,
		);
	}
	return runRecord;
}

export async function executeVariantRun(
	runId: string,
	options: ExecuteVariantRunOptions | VariantProcessRunner = {},
) {
	const executeOptions =
		typeof options === "function" ? { processRunner: options } : options;
	const processRunner = executeOptions.processRunner ?? runProcess;
	const runRecord = await claimVariantRun(runId);
	if (!runRecord) return null;
	const workspacePath = runRecord.workspacePath;
	const runtimeSpec = agentRuntimeSpecFromStoredRun(runRecord);
	const timeoutMs = agentTimeoutMs(runtimeSpec.core);
	const runtimeDefinition = agentRuntimeDefinition(runtimeSpec.core);
	let pollTranscript = runRecord.transcript;
	let fileWrite = Promise.resolve();
	let transcriptWrite = Promise.resolve();
	let transcriptWriteError: unknown;
	let stderrText = "";
	try {
		const onStdoutLine = (line: string) => {
			fileWrite = fileWrite.then(() => appendRunTranscriptLine(runId, line));
			pollTranscript = tailJsonlForPoll(
				`${pollTranscript}${line}\n`,
				MAX_POLL_TRANSCRIPT_CHARS,
			);
			transcriptWrite = transcriptWrite
				.then(() => persistTranscript(runId, pollTranscript))
				.catch((error: unknown) => {
					transcriptWriteError ??= error;
				});
		};
		const onStderrLine = (line: string) => {
			stderrText = appendLimited(stderrText, `${line}\n`);
		};

		const agentResult = await runtimeDefinition.execute(runtimeSpec, {
			input: runRecord.inputPrompt,
			processRunner,
			runId,
			workspace: workspacePath,
			timeoutMs,
			onStdoutLine,
			onStderrLine,
			executeOptions,
		});

		const { result } = agentResult;
		await fileWrite;
		const fullTranscript = redactSecrets(
			(await readRunTranscriptFile(runId))?.trim() ||
				pollTranscript.trim() ||
				result.stdout.trim(),
		);
		const dbTranscript = transcriptBodyForDb(fullTranscript);
		stderrText = redactSecrets(result.stderr.trim() || stderrText.trim());
		transcriptWrite = transcriptWrite
			.then(() => persistTranscript(runId, dbTranscript))
			.catch((error: unknown) => {
				transcriptWriteError ??= error;
			});
		await transcriptWrite;
		if (transcriptWriteError) throw transcriptWriteError;
		if (result.code !== 0 || result.timedOut) {
			throw new Error(
				agentFailureMessage(runtimeSpec.core, result, stderrText),
			);
		}
		const manifest = await readVariantManifest(workspacePath);
		const detectedChanges = await detectChangedFiles(workspacePath);
		const validation = validateVariantReceipt(manifest, {
			detectedChangedFiles: detectedChanges,
		});
		const changedFiles = validation.changedFiles;
		if (!validation.passed) throw new Error(validation.summary);
		const previewHtml = await inlineBuiltPreview(
			workspacePath,
			manifest.previewPath,
		);
		if (!isUsablePreviewHtml(previewHtml)) {
			throw new Error(
				"Built preview is missing or malformed: preview artifact is too small to render a complete storefront.",
			);
		}
		return finalizeVariantRun(runId, {
			status: "succeeded",
			...agentRuntimePersistenceFields(
				runtimeSpec,
				agentResult.codexAuthSelection,
			),
			manifest: JSON.stringify(manifest, null, 2),
			transcript: dbTranscript,
			stdout: dbTranscript,
			stderr: stderrText,
			testsPassed: manifest.testsPassed,
			buildPassed: manifest.buildPassed,
			commerceInvariantsOk: manifest.commerceInvariantsPreserved,
			changedFiles: JSON.stringify(changedFiles),
			validationResult: validation.summary,
			outputSummary: manifest.summary,
			previewHtml,
			completedAt: new Date(),
		});
	} catch (error) {
		await fileWrite;
		await transcriptWrite;
		const failure = error ?? transcriptWriteError;
		const message = redactSecrets(
			failure instanceof Error ? failure.message : String(failure),
		);
		const agentName = agentDisplayName(runtimeSpec.core);
		const fullTranscript = redactSecrets(
			await resolveFullTranscript(runId, pollTranscript),
		);
		const dbTranscript = transcriptBodyForDb(fullTranscript);
		return finalizeVariantRun(runId, {
			status: "failed",
			...agentRuntimePersistenceFields(runtimeSpec),
			transcript: dbTranscript,
			stdout: dbTranscript,
			stderr: stderrText,
			error: message,
			validationResult: `Validation: failed\n${message}`,
			outputSummary: `${agentName} did not produce a validated storefront variant.`,
			completedAt: new Date(),
		});
	}
}

/** Resolve agent settings from a form POST for API routes. */
export function resolveAgentFromForm(form: FormData) {
	return resolveAgentRuntimeSpecFromForm(form, { strict: true });
}
