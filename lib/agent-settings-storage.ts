export type AgentCoreChoice = "codex" | "pi";

export interface AgentSettings {
	agentCore: AgentCoreChoice;
	agentHarness: string;
	model: string;
	reasoningEffort: string;
	authMode: string;
}

export const AGENT_SETTINGS_STORAGE_KEY = "promo-studio-pi.agent-settings";

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
	agentCore: "codex",
	agentHarness: "sdk",
	model: "codex-default",
	reasoningEffort: "codex-default",
	authMode: "auto",
};

export function readAgentSettings(): AgentSettings {
	if (typeof window === "undefined") return DEFAULT_AGENT_SETTINGS;
	try {
		const raw = window.localStorage.getItem(AGENT_SETTINGS_STORAGE_KEY);
		if (!raw) return DEFAULT_AGENT_SETTINGS;
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return DEFAULT_AGENT_SETTINGS;
		const record = parsed as Record<string, unknown>;
		const agentCore = record.agentCore === "pi" ? "pi" : "codex";
		const harness =
			typeof record.agentHarness === "string"
				? record.agentHarness
				: DEFAULT_AGENT_SETTINGS.agentHarness;
		return {
			agentCore,
			agentHarness: agentCore === "pi" ? "json" : harness,
			model:
				typeof record.model === "string"
					? record.model
					: DEFAULT_AGENT_SETTINGS.model,
			reasoningEffort:
				typeof record.reasoningEffort === "string"
					? record.reasoningEffort
					: DEFAULT_AGENT_SETTINGS.reasoningEffort,
			authMode:
				typeof record.authMode === "string"
					? record.authMode
					: DEFAULT_AGENT_SETTINGS.authMode,
		};
	} catch {
		return DEFAULT_AGENT_SETTINGS;
	}
}

export function writeAgentSettings(settings: AgentSettings) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		AGENT_SETTINGS_STORAGE_KEY,
		JSON.stringify(settings),
	);
}
