/** User-facing strings keyed by agent core (codex | pi). */

export type AgentCoreId = "codex" | "pi";

const LEGACY_WORKSPACE_DIR = "codex-workspaces";
const CANONICAL_WORKSPACE_DIR = "agent-workspaces";

export function parseAgentCoreId(
	value: string | null | undefined,
): AgentCoreId {
	return value === "pi" ? "pi" : "codex";
}

export function agentDisplayName(core: AgentCoreId | string): string {
	return parseAgentCoreId(core) === "pi" ? "Pi" : "Codex";
}

const PLACEHOLDER_MODELS = new Set(["", "codex-default", "pi-default"]);

/** Model id segment from stored `selectedModel` (strips provider and :thinking). */
export function modelIdFromSelected(selectedModel: string): string {
	const value = selectedModel.trim();
	if (!value || PLACEHOLDER_MODELS.has(value)) return "";
	const slash = value.indexOf("/");
	let rest = slash >= 0 ? value.slice(slash + 1) : value;
	const colon = rest.indexOf(":");
	if (colon > 0 && /^[a-z0-9.-]+$/i.test(rest.slice(0, colon))) {
		rest = rest.slice(0, colon);
	}
	return rest;
}

/** User-facing model name, e.g. `cursor/composer-2.5` → `Composer 2.5`. */
export function humanizeModelId(modelId: string): string {
	if (!modelId) return "";
	const lower = modelId.toLowerCase();
	if (lower.startsWith("gpt")) {
		const rest = modelId.slice(3).replace(/^-/, "");
		const dash = rest.indexOf("-");
		if (dash === -1) return `GPT-${rest}`;
		return `GPT-${rest.slice(0, dash)} ${rest.slice(dash + 1)}`;
	}
	return modelId
		.split("-")
		.map((segment) => {
			if (/^\d/.test(segment) || segment.includes(".")) return segment;
			return segment.charAt(0).toUpperCase() + segment.slice(1);
		})
		.join(" ");
}

/** Run-facing label: prefer resolved model over harness core (Pi/Codex). */
export function runAgentDisplayLabel(params: {
	agentCore: AgentCoreId | string;
	selectedModel?: string | null;
}): string {
	const modelId = modelIdFromSelected(params.selectedModel ?? "");
	if (modelId) return humanizeModelId(modelId);
	return agentDisplayName(params.agentCore);
}

export function builtVariantHeading(
	agentCore: AgentCoreId | string,
	selectedModel?: string | null,
): string {
	const label = runAgentDisplayLabel({ agentCore, selectedModel });
	return `After: ${label}-built campaign variant`;
}

/** Studio landing hero sentence keyed to selected agent core. */
export function studioAgentIntroSentence(
	core: AgentCoreId | string,
	userName: string,
): string {
	const agent = agentDisplayName(core);
	return `Signed in as ${userName}. ${agent} edits an isolated storefront workspace, streams activity, runs validation, and saves the artifact.`;
}

/** Normalize legacy on-disk dir name for all UI surfaces (receipts, shell output, lists). */
export function formatWorkspacePathForDisplay(workspacePath: string): string {
	return workspacePath.replaceAll(
		LEGACY_WORKSPACE_DIR,
		CANONICAL_WORKSPACE_DIR,
	);
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
	normalized = normalized.replace(/\s+&&\s+/g, "\n  && ");
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
