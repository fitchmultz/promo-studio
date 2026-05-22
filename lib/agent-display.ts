/** User-facing strings keyed by agent core (codex | pi). */

export type AgentCoreId = "codex" | "pi";

export function parseAgentCoreId(value: string | null | undefined): AgentCoreId {
	return value === "pi" ? "pi" : "codex";
}

export function agentDisplayName(core: AgentCoreId | string): string {
	return parseAgentCoreId(core) === "pi" ? "Pi" : "Codex";
}

export function builtVariantHeading(core: AgentCoreId | string): string {
	return parseAgentCoreId(core) === "pi"
		? "After: Pi-built campaign variant"
		: "After: Codex-built campaign variant";
}

/** Display path shown in receipts; on-disk dir may still be codex-workspaces/. */
export function workspacePathForDisplay(
	core: AgentCoreId | string,
	workspacePath: string,
): string {
	if (parseAgentCoreId(core) !== "pi") return workspacePath;
	return workspacePath.replace(/codex-workspaces\//g, "agent-workspaces/");
}
