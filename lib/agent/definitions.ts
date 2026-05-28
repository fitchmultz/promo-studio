import {
	CODEX_DEFAULT_MODEL,
	CURSOR_DEFAULT_SETTINGS_MODEL,
	PI_DEFAULT_SETTINGS_MODEL,
} from "@/lib/agent-defaults";
import type { AgentCore, AgentHarness } from "@/lib/agent/types";

export interface AgentCoreDefinition {
	core: AgentCore;
	displayName: string;
	harnesses: Array<{ value: AgentHarness; label: string }>;
	defaultHarness: AgentHarness;
	defaultModel: string;
	modelOptions: string[];
	showAuthMode: boolean;
	showReasoningEffort: boolean;
	harnessDescription: string;
}

export const AGENT_CORE_DEFINITIONS = {
	codex: {
		core: "codex",
		displayName: "Codex",
		harnesses: [
			{ value: "sdk", label: "Codex SDK" },
			{ value: "exec", label: "codex exec" },
		],
		defaultHarness: "sdk",
		defaultModel: CODEX_DEFAULT_MODEL,
		modelOptions: [
			CODEX_DEFAULT_MODEL,
			"gpt-5.5",
			"gpt-5.5-mini",
			"gpt-5.4-mini",
		],
		showAuthMode: true,
		showReasoningEffort: true,
		harnessDescription: "Runs Codex through the selected SDK or exec harness.",
	},
	pi: {
		core: "pi",
		displayName: "Pi",
		harnesses: [{ value: "json", label: "pi JSON CLI" }],
		defaultHarness: "json",
		defaultModel: PI_DEFAULT_SETTINGS_MODEL,
		modelOptions: [],
		showAuthMode: false,
		showReasoningEffort: false,
		harnessDescription:
			"Pi runs pi --mode json in the isolated storefront. The campaign prompt is sent on stdin. Extension models, for example cursor/composer-2.5, are passed via --model.",
	},
	cursor: {
		core: "cursor",
		displayName: "Cursor",
		harnesses: [{ value: "sdk", label: "Cursor SDK" }],
		defaultHarness: "sdk",
		defaultModel: CURSOR_DEFAULT_SETTINGS_MODEL,
		modelOptions: [
			CURSOR_DEFAULT_SETTINGS_MODEL,
			"composer-2.5",
			"cursor-default",
		],
		showAuthMode: false,
		showReasoningEffort: false,
		harnessDescription:
			"Runs Agent.create + Agent.send with cwd set to the isolated storefront. Requires CURSOR_API_KEY.",
	},
} as const satisfies Record<AgentCore, AgentCoreDefinition>;

export const AGENT_CORE_ORDER: AgentCore[] = ["codex", "pi", "cursor"];

export function agentCoreDefinition(core: AgentCore): AgentCoreDefinition {
	return AGENT_CORE_DEFINITIONS[core];
}

export function agentDisplayName(core: AgentCore): string {
	return agentCoreDefinition(core).displayName;
}

export function defaultHarnessForCore(core: AgentCore): AgentHarness {
	return agentCoreDefinition(core).defaultHarness;
}

export function defaultModelForCore(core: AgentCore): string {
	return agentCoreDefinition(core).defaultModel;
}

export function isHarnessForCore(
	core: AgentCore,
	harness: string,
): harness is AgentHarness {
	return agentCoreDefinition(core).harnesses.some(
		(option) => option.value === harness,
	);
}
