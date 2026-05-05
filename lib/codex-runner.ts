import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Product, User } from "@prisma/client";
import {
	CODEX_DEFAULT_MODEL,
	CODEX_DEFAULT_REASONING_EFFORT,
	type CodexAuthMode,
	type CodexReasoningEffort,
	type CodexRuntime,
	codexChildEnv,
	codexModelArgs,
	codexReasoningArgs,
	env,
	paths as appPaths,
	normalizeCodexModel,
	normalizeCodexReasoningEffort,
	redactSecrets,
	selectCodexApiKeyFallbackMode,
	selectCodexMode,
	selectedCodexModel,
	selectedCodexReasoningEffort,
	type SelectedCodexAuthMode,
} from "@/lib/config";
import { prisma } from "@/lib/db";
import {
	isSafeWorkspaceFile,
	readVariantManifest,
	validateVariantReceipt,
} from "@/lib/validation";
import { buildVariantPrompt } from "@/lib/variant-prompt";
import { createVariantWorkspace, detectChangedFiles } from "@/lib/workspace";

const MAX_PROCESS_OUTPUT_CHARS = 120000;

interface ProcessResult {
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
}

interface ProcessOptions {
	cwd: string;
	env?: NodeJS.ProcessEnv;
	input?: string;
	timeoutMs?: number;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}

interface CodexSelection {
	selectedMode: SelectedCodexAuthMode;
	keySource: "CODEX_API_KEY" | "OPENAI_API_KEY" | "none";
}

interface RuntimeOptions {
	input: string;
	keySource: CodexSelection["keySource"];
	requestedEffort: CodexReasoningEffort | "";
	requestedModel: string;
	timeoutMs: number;
	workspace: string;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}

export type VariantProcessRunner = (
	command: string,
	args: string[],
	options: ProcessOptions,
) => Promise<ProcessResult>;

export type VariantSdkRunner = (
	options: RuntimeOptions,
) => Promise<ProcessResult>;

interface ExecuteVariantRunOptions {
	processRunner?: VariantProcessRunner;
	sdkRunner?: VariantSdkRunner;
}

function appendLimited(current: string, next: string) {
	const combined = current + next;
	if (combined.length <= MAX_PROCESS_OUTPUT_CHARS) return combined;
	return combined.slice(combined.length - MAX_PROCESS_OUTPUT_CHARS);
}

function emitLines(
	buffer: { value: string },
	chunk: string,
	emit?: (line: string) => void,
) {
	buffer.value += chunk;
	const lines = buffer.value.split(/\r?\n/);
	buffer.value = lines.pop() ?? "";
	for (const line of lines) {
		if (line.trim()) emit?.(redactSecrets(line));
	}
}

function run(command: string, args: string[], options: ProcessOptions) {
	return new Promise<ProcessResult>((resolve) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			detached: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;
		const stdoutBuffer = { value: "" };
		const stderrBuffer = { value: "" };

		function killProcessGroup(signal: NodeJS.Signals) {
			if (!child.pid) return;
			try {
				process.kill(-child.pid, signal);
			} catch {
				child.kill(signal);
			}
		}

		function finish(result: ProcessResult) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (stdoutBuffer.value.trim())
				options.onStdoutLine?.(redactSecrets(stdoutBuffer.value));
			if (stderrBuffer.value.trim())
				options.onStderrLine?.(redactSecrets(stderrBuffer.value));
			resolve(result);
		}

		const timer = setTimeout(() => {
			timedOut = true;
			killProcessGroup("SIGTERM");
			setTimeout(() => killProcessGroup("SIGKILL"), 1500).unref();
			finish({ code: null, stdout, stderr, timedOut: true });
		}, options.timeoutMs ?? env.CODEX_TIMEOUT_MS);

		child.stdout.on("data", (chunk) => {
			const text = chunk.toString();
			stdout = appendLimited(stdout, text);
			emitLines(stdoutBuffer, text, options.onStdoutLine);
		});
		child.stderr.on("data", (chunk) => {
			const text = chunk.toString();
			stderr = appendLimited(stderr, text);
			emitLines(stderrBuffer, text, options.onStderrLine);
		});
		child.on("error", (error) => {
			finish({ code: 127, stdout, stderr: error.message, timedOut });
		});
		child.on("close", (code) => {
			finish({ code: timedOut ? null : code, stdout, stderr, timedOut });
		});
		child.stdin.end(options.input ?? "");
	});
}

function looksLikeAuthFailure(result: ProcessResult) {
	const text = `${result.stdout}\n${result.stderr}`;
	return /(?:\bunauthorized\b|\b401\b|\bcredentials?\b|\bapi[\s_-]*key\b|\blogged\s*in\b|\bnot\s*authenticated\b|\bmust\s*authenticate\b|\bauthentication\s+failed\b|\bnot\s+logged\s+in\b)/i.test(
		text,
	);
}

function codexExecArgs(
	workspace: string,
	requestedModel: string,
	requestedEffort: string,
) {
	return [
		"exec",
		"--json",
		"--sandbox",
		"workspace-write",
		"--skip-git-repo-check",
		"--cd",
		workspace,
		...codexModelArgs(requestedModel),
		...codexReasoningArgs(requestedEffort),
		"-",
	];
}

function buildCodexExecInvocation(
	workspace: string,
	requestedModel: string,
	requestedEffort: string,
) {
	return [
		"codex",
		...codexExecArgs(workspace, requestedModel, requestedEffort),
	].join(" ");
}

function buildCodexSdkInvocation(params: {
	workspace: string;
	selectedModel: string;
	selectedEffort: string;
}) {
	return [
		"Codex TypeScript SDK runStreamed",
		`workingDirectory=${params.workspace}`,
		"sandboxMode=workspace-write",
		"skipGitRepoCheck=true",
		`model=${params.selectedModel}`,
		`modelReasoningEffort=${params.selectedEffort}`,
	].join(" ");
}

function buildCodexInvocation(params: {
	runtime: CodexRuntime;
	workspace: string;
	requestedModel: string;
	requestedEffort: string;
	selectedModel: string;
	selectedEffort: string;
}) {
	if (params.runtime === "exec") {
		return buildCodexExecInvocation(
			params.workspace,
			params.requestedModel,
			params.requestedEffort,
		);
	}
	return buildCodexSdkInvocation(params);
}

function codexNpmCliPath() {
	return path.join(
		appPaths.projectRoot,
		"node_modules",
		"@openai",
		"codex",
		"bin",
		"codex.js",
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

export const defaultSdkRunner: VariantSdkRunner = async (options) => {
	const { Codex } = await import("@openai/codex-sdk");
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
	let stdout = "";
	let streamFailure = "";
	try {
		const codex = new Codex({
			codexPathOverride: codexNpmCliPath(),
			env: toSdkEnv(codexChildEnv(options.keySource)),
		});
		const thread = codex.startThread({
			workingDirectory: options.workspace,
			skipGitRepoCheck: true,
			sandboxMode: "workspace-write",
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

async function runCodexWithFallback(params: {
	runtime: CodexRuntime;
	input: string;
	processRunner: VariantProcessRunner;
	sdkRunner: VariantSdkRunner;
	requestedAuthMode: CodexAuthMode;
	requestedModel: string;
	requestedEffort: CodexReasoningEffort | "";
	selection: CodexSelection;
	workspace: string;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}) {
	const baseOptions = {
		input: params.input,
		timeoutMs: env.CODEX_TIMEOUT_MS,
		requestedModel: params.requestedModel,
		requestedEffort: params.requestedEffort,
		workspace: params.workspace,
		onStdoutLine: params.onStdoutLine,
		onStderrLine: params.onStderrLine,
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

function codexEventId(line: string, index: number) {
	return `${index + 1}:${createHash("sha256").update(line).digest("hex").slice(0, 12)}`;
}

export function parseCodexEvents(transcript: string) {
	return transcript
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line, index) => {
			const id = codexEventId(line, index);
			try {
				const parsed = JSON.parse(line) as Record<string, unknown>;
				return { id, raw: line, type: String(parsed.type ?? "event"), parsed };
			} catch {
				return { id, raw: line, type: "log", parsed: { message: line } };
			}
		});
}

export async function createVariantRun(params: {
	user: User;
	product: Product;
	campaignBrief: string;
	campaignGoal: string;
	requestedAuthMode: CodexAuthMode;
	requestedModel?: string;
	requestedEffort?: string;
	runtime?: CodexRuntime;
	runner?: VariantProcessRunner;
	sdkRunner?: VariantSdkRunner;
}) {
	const selection = selectCodexMode(params.requestedAuthMode);
	if (selection.selectedMode === "api-key" && selection.keySource === "none") {
		throw new Error(
			"API-key mode requested, but neither CODEX_API_KEY nor OPENAI_API_KEY is configured.",
		);
	}
	const runtime = params.runtime ?? env.CODEX_RUNTIME;
	const runId = randomUUID();
	const workspace = await createVariantWorkspace(runId);
	const requestedModel = normalizeCodexModel(
		params.requestedModel ?? env.CODEX_MODEL,
	);
	const selectedModel = selectedCodexModel(requestedModel);
	const requestedEffort = normalizeCodexReasoningEffort(
		params.requestedEffort ?? env.CODEX_REASONING_EFFORT,
	);
	const selectedEffort = selectedCodexReasoningEffort(requestedEffort);
	const prompt = buildVariantPrompt({
		product: params.product,
		campaignBrief: params.campaignBrief,
		campaignGoal: params.campaignGoal,
	});
	const codexCommand = buildCodexInvocation({
		runtime,
		workspace,
		requestedModel,
		requestedEffort,
		selectedModel,
		selectedEffort,
	});
	const runRecord = await prisma.variantRun.create({
		data: {
			id: runId,
			productId: params.product.id,
			userId: params.user.id,
			status: "running",
			campaignBrief: params.campaignBrief,
			campaignGoal: params.campaignGoal,
			workspacePath: workspace,
			requestedAuthMode: params.requestedAuthMode,
			selectedAuthMode: selection.selectedMode,
			requestedModel: requestedModel || CODEX_DEFAULT_MODEL,
			selectedModel,
			requestedEffort: requestedEffort || CODEX_DEFAULT_REASONING_EFFORT,
			selectedEffort,
			codexRuntime: runtime,
			codexCommand,
			inputPrompt: prompt,
			outputSummary: `Codex ${selectedModel} is editing an isolated storefront workspace with ${selectedEffort} reasoning.`,
		},
	});
	void executeVariantRun(runRecord.id, {
		processRunner: params.runner,
		sdkRunner: params.sdkRunner,
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
	const processRunner = executeOptions.processRunner ?? run;
	const sdkRunner = executeOptions.sdkRunner ?? defaultSdkRunner;
	const runtime =
		runRecord.codexRuntime === "exec" || runRecord.codexRuntime === "sdk"
			? runRecord.codexRuntime
			: env.CODEX_RUNTIME;
	const requestedModel =
		runRecord.requestedModel === CODEX_DEFAULT_MODEL
			? ""
			: runRecord.requestedModel;
	const requestedEffort =
		runRecord.requestedEffort === CODEX_DEFAULT_REASONING_EFFORT
			? ""
			: normalizeCodexReasoningEffort(runRecord.requestedEffort);
	const initialSelection = selectCodexMode(
		runRecord.requestedAuthMode as CodexAuthMode,
	);
	let transcript = runRecord.transcript;
	let transcriptWrite = Promise.resolve();
	let transcriptWriteError: unknown;
	let stderrText = "";
	try {
		const { result, selection } = await runCodexWithFallback({
			runtime,
			input: runRecord.inputPrompt,
			processRunner,
			sdkRunner,
			requestedAuthMode: runRecord.requestedAuthMode as CodexAuthMode,
			requestedModel,
			requestedEffort,
			selection: initialSelection,
			workspace: runRecord.workspacePath,
			onStdoutLine: (line) => {
				transcript = appendLimited(transcript, `${line}\n`);
				transcriptWrite = transcriptWrite
					.then(() => persistTranscript(runId, transcript))
					.catch((error: unknown) => {
						transcriptWriteError ??= error;
					});
			},
			onStderrLine: (line) => {
				stderrText = appendLimited(stderrText, `${line}\n`);
			},
		});
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
			throw new Error(
				result.timedOut
					? "Codex timed out before completing the storefront variant."
					: `Codex exited with code ${result.code ?? "unknown"}.`,
			);
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
		return prisma.variantRun.update({
			where: { id: runId },
			data: {
				status: "failed",
				transcript,
				stdout: transcript,
				stderr: stderrText,
				error: message,
				validationResult: `Validation: failed\n${message}`,
				outputSummary: "Codex did not produce a validated storefront variant.",
				completedAt: new Date(),
			},
		});
	}
}
