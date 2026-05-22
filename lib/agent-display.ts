/** User-facing strings keyed by agent core (codex | pi). */

export type AgentCoreId = "codex" | "pi";

const LEGACY_WORKSPACE_DIR = "codex-workspaces";
const CANONICAL_WORKSPACE_DIR = "agent-workspaces";

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

/** Normalize legacy on-disk dir name for all UI surfaces (receipts, shell output, lists). */
export function formatWorkspacePathForDisplay(workspacePath: string): string {
	return workspacePath.replaceAll(LEGACY_WORKSPACE_DIR, CANONICAL_WORKSPACE_DIR);
}

export function workspacePathForDisplay(
	_core: AgentCoreId | string,
	workspacePath: string,
): string {
	return formatWorkspacePathForDisplay(workspacePath);
}

/** Shorten shell commands for activity stream (agent-workspaces + drop repo prefix). */
export function formatShellCommandForDisplay(command: string): string {
	let normalized = formatWorkspacePathForDisplay(command.trim());
	const marker = `${CANONICAL_WORKSPACE_DIR}/`;
	const index = normalized.indexOf(marker);
	if (index >= 0) {
		normalized = normalized.slice(index);
	}
	normalized = normalized.replace(
		/\s+&&\s+/g,
		"\n  && ",
	);
	return normalized;
}

function toDate(value: Date | string | null | undefined, fallback: Date): Date {
	if (!value) return fallback;
	return value instanceof Date ? value : new Date(value);
}

export function formatRunDuration(
	startedAt: Date | string,
	completedAt: Date | string | null | undefined,
	now = new Date(),
): string {
	const start = toDate(startedAt, now);
	const end = toDate(completedAt, now);
	const ms = Math.max(0, end.getTime() - start.getTime());
	const totalSec = Math.floor(ms / 1000);
	if (totalSec < 60) return `${totalSec}s`;
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}
