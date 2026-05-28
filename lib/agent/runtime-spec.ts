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
	selectCodexMode,
	type CodexAuthMode,
	type CodexReasoningEffort,
} from "@/lib/config";
import {
	agentDisplayName,
	defaultHarnessForCore,
	isHarnessForCore,
} from "@/lib/agent/definitions";
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

function parseHarnessForCore(
	core: AgentCore,
	raw: unknown,
	options: ResolveAgentRuntimeSpecOptions = {},
) {
	const value = stringValue(raw);
	if (!value) return defaultHarnessForCore(core);
	if (isHarnessForCore(core, value)) return value;
	if (options.strict) {
		throw new Error(`Invalid ${agentDisplayName(core)} harness: ${value}.`);
	}
	return defaultHarnessForCore(core);
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
	if (core === "pi") {
		parseHarnessForCore(core, input.harness, options);
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
			requestedModel,
			requestedEffort: "",
			selectedModel,
			selectedEffort,
			legacyRuntime: "json",
		};
	}

	if (core === "cursor") {
		parseHarnessForCore(core, input.harness, options);
		const requestedModel = normalizeCursorModel(
			input.model ?? env.CURSOR_MODEL,
		);
		return {
			core,
			harness: "sdk",
			requestedModel,
			requestedEffort: "",
			selectedModel: selectedCursorModel(requestedModel),
			selectedEffort: "default",
			legacyRuntime: "cursor-sdk",
		};
	}

	const requestedAuthMode = parseCodexAuthModeValue(
		input.authMode,
		env.CODEX_AUTH_MODE,
		options,
	);
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

export function agentRuntimePersistenceFields(
	runtimeSpec: AgentRuntimeSpec,
	codexAuthSelection?: { selectedMode: string },
) {
	const requestedAuthMode =
		runtimeSpec.core === "codex" ? runtimeSpec.requestedAuthMode : "";
	const selectedAuthMode =
		runtimeSpec.core === "codex"
			? (codexAuthSelection?.selectedMode ??
				selectCodexMode(runtimeSpec.requestedAuthMode).selectedMode)
			: "";
	return {
		requestedAuthMode,
		selectedAuthMode,
		requestedModel:
			runtimeSpec.requestedModel ||
			(runtimeSpec.core === "pi"
				? PI_DEFAULT_MODEL
				: runtimeSpec.core === "cursor"
					? CURSOR_DEFAULT_MODEL
					: CODEX_DEFAULT_MODEL),
		selectedModel: runtimeSpec.selectedModel,
		requestedEffort:
			runtimeSpec.core === "codex"
				? runtimeSpec.requestedEffort || CODEX_DEFAULT_REASONING_EFFORT
				: runtimeSpec.selectedEffort,
		selectedEffort: runtimeSpec.selectedEffort,
		agentCore: runtimeSpec.core,
		agentHarness: runtimeSpec.harness,
		codexRuntime: runtimeSpec.legacyRuntime,
	};
}

export function agentRuntimeSpecFromStoredRun(
	run: StoredAgentRuntimeFields,
): AgentRuntimeSpec {
	let core = parseAgentCoreValue(run.agentCore, "codex");
	if (core !== "cursor" && run.codexRuntime === "cursor-sdk") {
		core = "cursor";
	}
	if (core === "pi") {
		const requestedModel =
			run.requestedModel === PI_DEFAULT_MODEL ? "" : run.requestedModel;
		return {
			core,
			harness: "json",
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
			requestedModel,
			requestedEffort: "",
			selectedModel: run.selectedModel || selectedCursorModel(requestedModel),
			selectedEffort: run.selectedEffort || "default",
			legacyRuntime: "cursor-sdk",
		};
	}

	const requestedAuthMode = parseCodexAuthModeValue(
		run.requestedAuthMode,
		"auto",
	);
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
