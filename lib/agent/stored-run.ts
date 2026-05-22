import type { VariantRun } from "@prisma/client";
import {
	env,
	type AgentCore,
	type AgentHarness,
	type CodexAuthMode,
} from "@/lib/config";

function isAgentHarness(value: string): value is AgentHarness {
	return value === "sdk" || value === "exec" || value === "json";
}

function isCodexAuthMode(value: string): value is CodexAuthMode {
	return value === "auto" || value === "subscription" || value === "api-key";
}

export function parseStoredAgentCore(value: string): AgentCore {
	return value === "pi" ? "pi" : "codex";
}

export function parseStoredAgentHarness(
	value: string,
	core: AgentCore,
): AgentHarness {
	if (isAgentHarness(value)) return value;
	return core === "pi" ? "sdk" : env.CODEX_RUNTIME;
}

export function parseStoredCodexAuthMode(value: string): CodexAuthMode {
	if (isCodexAuthMode(value)) return value;
	return env.CODEX_AUTH_MODE;
}

/** Harness label input for receipts (legacy codexRuntime column included). */
export function receiptHarness(
	run: Pick<VariantRun, "agentCore" | "agentHarness" | "codexRuntime">,
): AgentHarness {
	if (isAgentHarness(run.agentHarness)) return run.agentHarness;
	if (run.codexRuntime === "exec" || run.codexRuntime === "json") {
		return run.codexRuntime;
	}
	return "sdk";
}
