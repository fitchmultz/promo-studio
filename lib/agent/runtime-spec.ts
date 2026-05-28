import {
	CODEX_DEFAULT_MODEL,
	CODEX_DEFAULT_REASONING_EFFORT,
	CURSOR_DEFAULT_MODEL,
	env,
	normalizeCodexModel,
	normalizeCodexReasoningEffort,
	normalizeCursorModel,
	normalizePiModel,
	PI_DEFAULT_MODEL,
	selectedCursorModel,
	selectedCodexModel,
	selectedCodexReasoningEffort,
	selectedPiModel,
	selectedPiThinkingFromModel,
	type CodexAuthMode,
	type CodexReasoningEffort,
} from "@/lib/config";
import type {
	AgentCore,
	AgentRuntimeSpec,
	CodexAgentHarness,
} from "@/lib/agent/types";

export interface AgentRuntimeSpecInput {
	core?: FormDataEntryValue | string | null;
	harness?: FormDataEntryValue | string | null;
	authMode?: FormDataEntryValue | string | null;
	model?: FormDataEntryValue | string | null;
	effort?: FormDataEntryValue | string | null;
}

interface ResolveAgentRuntimeSpecOptions {
	/** Reject invalid supplied values instead of falling back to env defaults. */
	strict?: boolean;
}

export interface StoredAgentRuntimeFields {
	agentCore: string;
	agentHarness: string;
	codexRuntime?: string;
	requestedAuthMode: string;
	requestedModel: string;
	requestedEffort: string;
	selectedModel: string;
	selectedEffort: string;
}

function stringValue(raw: unknown) {
	return String(raw ?? "").trim();
}

export function parseAgentCoreValue(
	raw: unknown,
	fallback: AgentCore = env.AGENT_CORE,
	options: ResolveAgentRuntimeSpecOptions = {},
): AgentCore {
	const value = stringValue(raw);
	if (!value) return fallback;
	if (value === "codex" || value === "pi" || value === "cursor") return value;
	if (options.strict) throw new Error(`Invalid agent core: ${value}.`);
	return fallback;
}

function parseCursorHarnessValue(
	raw: unknown,
	options: ResolveAgentRuntimeSpecOptions = {},
) {
	const value = stringValue(raw);
	if (!value || value === "sdk") return "sdk";
	if (options.strict) throw new Error(`Invalid Cursor harness: ${value}.`);
	return "sdk";
}

export function parseCodexHarnessValue(
	raw: unknown,
	fallback: CodexAgentHarness = env.CODEX_RUNTIME,
	options: ResolveAgentRuntimeSpecOptions = {},
): CodexAgentHarness {
	const value = stringValue(raw);
	if (!value) return fallback;
	if (value === "sdk" || value === "exec") return value;
	if (options.strict) throw new Error(`Invalid Codex harness: ${value}.`);
	return fallback;
}

function parsePiHarnessValue(
	raw: unknown,
	options: ResolveAgentRuntimeSpecOptions = {},
) {
	const value = stringValue(raw);
	if (!value || value === "json") return "json";
	if (options.strict) throw new Error(`Invalid Pi harness: ${value}.`);
	return "json";
}

export function parseCodexAuthModeValue(
	raw: unknown,
	fallback: CodexAuthMode = env.CODEX_AUTH_MODE,
	options: ResolveAgentRuntimeSpecOptions = {},
): CodexAuthMode {
	const value = stringValue(raw);
	if (!value) return fallback;
	if (value === "subscription" || value === "api-key" || value === "auto") {
		return value;
	}
	if (options.strict) throw new Error(`Invalid Codex auth mode: ${value}.`);
	return fallback;
}

export function resolveAgentRuntimeSpec(
	input: AgentRuntimeSpecInput = {},
	options: ResolveAgentRuntimeSpecOptions = {},
): AgentRuntimeSpec {
	const core = parseAgentCoreValue(input.core, env.AGENT_CORE, options);
	const requestedAuthMode = parseCodexAuthModeValue(
		input.authMode,
		env.CODEX_AUTH_MODE,
		options,
	);

	if (core === "pi") {
		parsePiHarnessValue(input.harness, options);
		const requestedModel = normalizePiModel(input.model ?? env.PI_MODEL);
		const selectedModel = selectedPiModel(requestedModel);
		let selectedEffort = "default";
		try {
			selectedEffort = selectedPiThinkingFromModel(requestedModel);
		} catch (error) {
			if (options.strict) throw error;
		}
		return {
			core,
			harness: "json",
			requestedAuthMode,
			requestedModel,
			requestedEffort: "",
			selectedModel,
			selectedEffort,
			legacyRuntime: "json",
		};
	}

	if (core === "cursor") {
		parseCursorHarnessValue(input.harness, options);
		const requestedModel = normalizeCursorModel(
			input.model ?? env.CURSOR_MODEL,
		);
		return {
			core,
			harness: "sdk",
			requestedAuthMode,
			requestedModel,
			requestedEffort: "",
			selectedModel: selectedCursorModel(requestedModel),
			selectedEffort: "default",
			legacyRuntime: "cursor-sdk",
		};
	}

	const harness = parseCodexHarnessValue(
		input.harness,
		env.CODEX_RUNTIME,
		options,
	);
	const requestedModel = normalizeCodexModel(input.model ?? env.CODEX_MODEL);
	const requestedEffort = normalizeCodexReasoningEffort(
		input.effort ?? env.CODEX_REASONING_EFFORT,
	);
	return {
		core,
		harness,
		requestedAuthMode,
		requestedModel,
		requestedEffort,
		selectedModel: selectedCodexModel(requestedModel),
		selectedEffort: selectedCodexReasoningEffort(requestedEffort),
		legacyRuntime: harness,
	};
}

export function resolveAgentRuntimeSpecFromForm(
	form: FormData,
	options: ResolveAgentRuntimeSpecOptions = {},
): AgentRuntimeSpec {
	return resolveAgentRuntimeSpec(
		{
			core: form.get("agentCore"),
			harness: form.get("agentHarness"),
			authMode: form.get("authMode"),
			model: form.get("model"),
			effort: form.get("reasoningEffort"),
		},
		options,
	);
}

export function agentRuntimeSpecFromStoredRun(
	run: StoredAgentRuntimeFields,
): AgentRuntimeSpec {
	let core = parseAgentCoreValue(run.agentCore, "codex");
	if (core !== "cursor" && run.codexRuntime === "cursor-sdk") {
		core = "cursor";
	}
	const requestedAuthMode = parseCodexAuthModeValue(
		run.requestedAuthMode,
		"auto",
	);
	if (core === "pi") {
		const requestedModel =
			run.requestedModel === PI_DEFAULT_MODEL ? "" : run.requestedModel;
		return {
			core,
			harness: "json",
			requestedAuthMode,
			requestedModel,
			requestedEffort: "",
			selectedModel: run.selectedModel || selectedPiModel(requestedModel),
			selectedEffort:
				run.selectedEffort || selectedPiThinkingFromModel(requestedModel),
			legacyRuntime: "json",
		};
	}

	if (core === "cursor") {
		const requestedModel =
			run.requestedModel === CURSOR_DEFAULT_MODEL ? "" : run.requestedModel;
		return {
			core,
			harness: "sdk",
			requestedAuthMode,
			requestedModel,
			requestedEffort: "",
			selectedModel: run.selectedModel || selectedCursorModel(requestedModel),
			selectedEffort: run.selectedEffort || "default",
			legacyRuntime: "cursor-sdk",
		};
	}

	const harness =
		run.agentHarness === "exec" ||
		(run.agentHarness !== "exec" && run.codexRuntime === "exec")
			? "exec"
			: parseCodexHarnessValue(run.agentHarness, "sdk");
	const requestedModel =
		run.requestedModel === CODEX_DEFAULT_MODEL ? "" : run.requestedModel;
	const requestedEffort: CodexReasoningEffort | "" =
		run.requestedEffort === CODEX_DEFAULT_REASONING_EFFORT
			? ""
			: normalizeCodexReasoningEffort(run.requestedEffort);
	return {
		core,
		harness,
		requestedAuthMode,
		requestedModel,
		requestedEffort,
		selectedModel: run.selectedModel || selectedCodexModel(requestedModel),
		selectedEffort:
			run.selectedEffort || selectedCodexReasoningEffort(requestedEffort),
		legacyRuntime: harness,
	};
}
