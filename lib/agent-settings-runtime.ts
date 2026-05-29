import { z } from "zod";
import {
	CODEX_DEFAULT_MODEL,
	CODEX_DEFAULT_REASONING_EFFORT,
} from "@/lib/agent-defaults";
import {
	defaultHarnessForCore,
	defaultModelForCore,
} from "@/lib/agent/definitions";
import {
	resolveAgentRuntimeSpec,
	type AgentRuntimeSpecInput,
} from "@/lib/agent/runtime-spec";
import type { AgentRuntimeSpec } from "@/lib/agent/types";
import {
	type AgentSettings,
	DEFAULT_AGENT_SETTINGS,
} from "@/lib/agent-settings-shared";

export type { AgentSettings } from "@/lib/agent-settings-shared";

const AgentSettingsPayloadSchema = z.object({
	agentCore: z.enum(["codex", "pi", "cursor"]),
	agentHarness: z.string(),
	model: z.string(),
	reasoningEffort: z.string(),
	authMode: z.string(),
});

function payloadToRuntimeSpecInput(
	settings: AgentSettings,
): AgentRuntimeSpecInput {
	return {
		core: settings.agentCore,
		harness: settings.agentHarness,
		authMode: settings.authMode,
		model: settings.model,
		effort: settings.reasoningEffort,
	};
}

export function agentSettingsFromRuntimeSpec(
	runtimeSpec: AgentRuntimeSpec,
): AgentSettings {
	if (runtimeSpec.core === "pi") {
		return {
			agentCore: "pi",
			agentHarness: defaultHarnessForCore("pi"),
			model: runtimeSpec.requestedModel || defaultModelForCore("pi"),
			reasoningEffort: CODEX_DEFAULT_REASONING_EFFORT,
			authMode: "auto",
		};
	}
	if (runtimeSpec.core === "cursor") {
		return {
			agentCore: "cursor",
			agentHarness: defaultHarnessForCore("cursor"),
			model: runtimeSpec.requestedModel || defaultModelForCore("cursor"),
			reasoningEffort: CODEX_DEFAULT_REASONING_EFFORT,
			authMode: "auto",
		};
	}
	return {
		agentCore: "codex",
		agentHarness: runtimeSpec.harness,
		model: runtimeSpec.requestedModel || CODEX_DEFAULT_MODEL,
		reasoningEffort:
			runtimeSpec.requestedEffort || CODEX_DEFAULT_REASONING_EFFORT,
		authMode: runtimeSpec.requestedAuthMode,
	};
}

export function parseAgentSettingsPayload(body: unknown): AgentSettings {
	const parsed = AgentSettingsPayloadSchema.safeParse(body);
	if (!parsed.success) throw new Error("Invalid agent settings payload.");
	return agentSettingsFromRuntimeSpec(
		resolveAgentRuntimeSpec(payloadToRuntimeSpecInput(parsed.data), {
			strict: true,
		}),
	);
}

export function parseStoredAgentSettings(
	raw: string | null | undefined,
): AgentSettings {
	if (!raw?.trim()) return DEFAULT_AGENT_SETTINGS;
	try {
		const parsed: unknown = JSON.parse(raw);
		const payload = AgentSettingsPayloadSchema.parse(parsed);
		return agentSettingsFromRuntimeSpec(
			resolveAgentRuntimeSpec(payloadToRuntimeSpecInput(payload), {
				strict: true,
			}),
		);
	} catch {
		return DEFAULT_AGENT_SETTINGS;
	}
}

export function serializeAgentSettings(settings: AgentSettings): string {
	return JSON.stringify(parseAgentSettingsPayload(settings));
}
