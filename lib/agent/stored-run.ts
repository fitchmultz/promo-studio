import type { VariantRun } from "@prisma/client";
import type { AgentCore, AgentHarness } from "@/lib/config";
import {
	agentRuntimeSpecFromStoredRun,
	parseAgentCoreValue,
} from "@/lib/agent/runtime-spec";

/** @deprecated Use agentRuntimeSpecFromStoredRun for stored run parsing. */
export function parseStoredAgentCore(value: string): AgentCore {
	return parseAgentCoreValue(value, "codex");
}

/** @deprecated Use agentRuntimeSpecFromStoredRun for stored run parsing. */
export function parseStoredAgentHarness(
	value: string,
	core: AgentCore,
): AgentHarness {
	return agentRuntimeSpecFromStoredRun({
		agentCore: core,
		agentHarness: value,
		requestedAuthMode: "auto",
		requestedModel: "codex-default",
		requestedEffort: "codex-default",
		selectedModel: "codex-default",
		selectedEffort: "codex-default",
	}).harness;
}

/** Harness label input for receipts (legacy codexRuntime column included). */
export function receiptHarness(
	run: Pick<
		VariantRun,
		| "agentCore"
		| "agentHarness"
		| "codexRuntime"
		| "requestedAuthMode"
		| "requestedModel"
		| "requestedEffort"
		| "selectedModel"
		| "selectedEffort"
	>,
): AgentHarness {
	return agentRuntimeSpecFromStoredRun(run).harness;
}
