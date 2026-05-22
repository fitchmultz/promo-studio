import { z } from "zod";

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

const StoredAgentSettingsSchema = z.object({
	agentCore: z.enum(["codex", "pi"]).catch("codex"),
	agentHarness: z.string().catch(DEFAULT_AGENT_SETTINGS.agentHarness),
	model: z.string().catch(DEFAULT_AGENT_SETTINGS.model),
	reasoningEffort: z.string().catch(DEFAULT_AGENT_SETTINGS.reasoningEffort),
	authMode: z.string().catch(DEFAULT_AGENT_SETTINGS.authMode),
});

export function readAgentSettings(): AgentSettings {
	if (typeof window === "undefined") return DEFAULT_AGENT_SETTINGS;
	try {
		const raw = window.localStorage.getItem(AGENT_SETTINGS_STORAGE_KEY);
		if (!raw) return DEFAULT_AGENT_SETTINGS;
		const parsed: unknown = JSON.parse(raw);
		const result = StoredAgentSettingsSchema.safeParse(parsed);
		if (!result.success) return DEFAULT_AGENT_SETTINGS;
		const data = result.data;
		return {
			...data,
			agentHarness: data.agentCore === "pi" ? "json" : data.agentHarness,
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
