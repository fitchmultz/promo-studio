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
	model: "cursor/composer-2.5",
	reasoningEffort: "codex-default",
	authMode: "auto",
};

const CODEX_REASONING_EFFORTS = new Set([
	"codex-default",
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
	if (settings.agentCore === "pi") {
		return {
			agentCore: "pi",
			agentHarness: "json",
			model: settings.model || "pi-default",
			reasoningEffort: "codex-default",
			authMode: codexAuthMode(settings.authMode),
		};
	}
	if (settings.agentCore === "cursor") {
		return {
			agentCore: "cursor",
			agentHarness: "sdk",
			model: settings.model || "composer-2.5-fast",
			reasoningEffort: "codex-default",
			authMode: codexAuthMode(settings.authMode),
		};
	}
	return {
		agentCore: "codex",
		agentHarness:
			settings.agentHarness === "exec" || settings.agentHarness === "sdk"
				? settings.agentHarness
				: "sdk",
		model: settings.model || "codex-default",
		reasoningEffort: CODEX_REASONING_EFFORTS.has(settings.reasoningEffort)
			? settings.reasoningEffort
			: "codex-default",
		authMode: codexAuthMode(settings.authMode),
	};
}
