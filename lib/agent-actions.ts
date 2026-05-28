import { isJsonObject } from "@/lib/json";

export type AgentActionKind =
	| "read"
	| "edit"
	| "test"
	| "build"
	| "manifest"
	| "shell"
	| "other";

export interface AgentAction {
	kind: AgentActionKind;
	sourceCore: string;
	toolName?: string;
	command?: string;
	path?: string;
	text?: string;
}

export interface AgentActionInputEvent {
	type: string;
	parsed: Record<string, unknown>;
	raw?: string;
}

const READ_TOOLS = new Set([
	"read",
	"glob",
	"grep",
	"find",
	"ls",
	"list",
	"search",
]);
const EDIT_TOOLS = new Set([
	"edit",
	"write",
	"create",
	"apply_patch",
	"multi_edit",
	"replace",
]);
const SHELL_TOOLS = new Set(["bash", "shell", "terminal", "run_command"]);

function normalizedToolName(toolName = "") {
	return toolName
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_");
}

function classifyCommand(command: string): AgentActionKind {
	const lower = command.toLowerCase();
	if (lower.includes("npm run build")) return "build";
	if (lower.includes("npm test") || lower.includes("vitest")) return "test";
	return "read";
}

function classifyPath(
	path: string,
	fallback: AgentActionKind,
): AgentActionKind {
	return /(^|\/)manifest\.json$/i.test(path) ? "manifest" : fallback;
}

function classifyTool(params: {
	toolName?: string;
	command?: string;
	path?: string;
}): AgentActionKind {
	const toolName = normalizedToolName(params.toolName);
	if (params.command && SHELL_TOOLS.has(toolName)) {
		return classifyCommand(params.command);
	}
	if (EDIT_TOOLS.has(toolName)) {
		return params.path ? classifyPath(params.path, "edit") : "edit";
	}
	if (READ_TOOLS.has(toolName)) {
		return params.path ? classifyPath(params.path, "read") : "read";
	}
	if (params.command) return classifyCommand(params.command);
	if (params.path) return classifyPath(params.path, "read");
	return "other";
}

function actionFromTool(params: {
	sourceCore: string;
	toolName?: string;
	command?: string;
	path?: string;
	text?: string;
}): AgentAction {
	return {
		kind: classifyTool(params),
		sourceCore: params.sourceCore,
		toolName: params.toolName,
		command: params.command,
		path: params.path,
		text: params.text,
	};
}

function codexActions(events: AgentActionInputEvent[]): AgentAction[] {
	const actions: AgentAction[] = [];
	for (const event of events) {
		const item = isJsonObject(event.parsed.item)
			? event.parsed.item
			: undefined;
		if (item?.type === "file_change") {
			actions.push({
				kind: "edit",
				sourceCore: "codex",
				toolName: "file_change",
			});
		}
		if (item?.type === "command_execution") {
			const command = typeof item.command === "string" ? item.command : "";
			actions.push(
				actionFromTool({ sourceCore: "codex", toolName: "shell", command }),
			);
		}
	}
	return actions;
}

function piActions(events: AgentActionInputEvent[]): AgentAction[] {
	const actions: AgentAction[] = [];
	for (const event of events) {
		if (
			event.type !== "tool_execution_start" &&
			event.type !== "tool_execution_end"
		)
			continue;
		const toolName =
			typeof event.parsed.toolName === "string" ? event.parsed.toolName : "";
		const args = event.parsed.args;
		const command =
			isJsonObject(args) && typeof args.command === "string"
				? args.command
				: undefined;
		const path =
			isJsonObject(args) && typeof args.path === "string"
				? args.path
				: undefined;
		actions.push(actionFromTool({ sourceCore: "pi", toolName, command, path }));
	}
	return actions;
}

function cursorActions(events: AgentActionInputEvent[]): AgentAction[] {
	const actions: AgentAction[] = [];
	for (const event of events) {
		if (event.type !== "tool_call") continue;
		const toolName =
			typeof event.parsed.name === "string" ? event.parsed.name : "";
		const args = event.parsed.args;
		const command =
			isJsonObject(args) && typeof args.command === "string"
				? args.command
				: undefined;
		const path =
			isJsonObject(args) && typeof args.path === "string"
				? args.path
				: undefined;
		actions.push(
			actionFromTool({ sourceCore: "cursor", toolName, command, path }),
		);
	}
	return actions;
}

export const AGENT_ACTION_EXTRACTORS: Record<
	string,
	(events: AgentActionInputEvent[]) => AgentAction[]
> = {
	codex: codexActions,
	pi: piActions,
	cursor: cursorActions,
};

export function agentActionsFromEvents(
	agentCore: string,
	events: AgentActionInputEvent[],
): AgentAction[] {
	return (AGENT_ACTION_EXTRACTORS[agentCore] ?? codexActions)(events);
}
