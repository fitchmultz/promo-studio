import {
	agentCoreDefinition,
	defaultHarnessForCore,
	defaultModelForCore,
} from "@/lib/agent/definitions";
import {
	CODEX_DEFAULT_REASONING_EFFORT,
	PI_DEFAULT_SETTINGS_MODEL,
} from "@/lib/agent-defaults";

export type AgentCoreChoice = "codex" | "pi" | "cursor";

export interface AgentSettings {
	agentCore: AgentCoreChoice;
	agentHarness: string;
	model: string;
	reasoningEffort: string;
	authMode: string;
}

/** Demo-friendly defaults for Promo Studio (overridable via server-stored prefs). */
export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
	agentCore: "pi",
	agentHarness: "json",
	model: PI_DEFAULT_SETTINGS_MODEL,
	reasoningEffort: CODEX_DEFAULT_REASONING_EFFORT,
	authMode: "auto",
};

const CODEX_REASONING_EFFORTS = new Set([
	CODEX_DEFAULT_REASONING_EFFORT,
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
]);

function codexAuthMode(value: string) {
	return value === "subscription" || value === "api-key" || value === "auto"
		? value
		: "auto";
}

/** Client-side UI normalization only. Server persistence re-validates with AgentRuntimeSpec. */
export function normalizeAgentSettings(settings: AgentSettings): AgentSettings {
	const definition = agentCoreDefinition(settings.agentCore);
	const harness = definition.harnesses.some(
		(option) => option.value === settings.agentHarness,
	)
		? settings.agentHarness
		: defaultHarnessForCore(settings.agentCore);
	return {
		agentCore: settings.agentCore,
		agentHarness: harness,
		model: settings.model || defaultModelForCore(settings.agentCore),
		reasoningEffort:
			definition.showReasoningEffort &&
			CODEX_REASONING_EFFORTS.has(settings.reasoningEffort)
				? settings.reasoningEffort
				: CODEX_DEFAULT_REASONING_EFFORT,
		authMode: definition.showAuthMode
			? codexAuthMode(settings.authMode)
			: "auto",
	};
}
