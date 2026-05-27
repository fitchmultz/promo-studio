import { formatShellCommandForDisplay } from "@/lib/agent-display";
import { isJsonObject } from "@/lib/json";

export interface CodexActivityInputEvent {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

export interface CodexActivityRow {
	id: string;
	label: string;
	body: string;
	variant: "prose" | "tool" | "muted";
}

const CODEX_OUTPUT_PREVIEW_CHARS = 600;

function itemFor(
	event: CodexActivityInputEvent,
): Record<string, unknown> | undefined {
	const item = event.parsed.item;
	return isJsonObject(item) ? item : undefined;
}

interface FileChangeEntry {
	path?: unknown;
	kind?: unknown;
}

function labelForCodex(event: CodexActivityInputEvent) {
	const item = itemFor(event);
	if (event.type === "thread.started") return "Codex thread";
	if (event.type === "turn.started") return "Codex turn";
	if (event.type === "tool_call") return "Tool call";
	if (event.type === "tool_output") return "Tool output";
	if (event.type === "agent_message") return "Agent message";
	if (item?.type === "agent_message") return "Agent message";
	if (item?.type === "command_execution") {
		return item.status === "completed"
			? "Shell command completed"
			: "Shell command started";
	}
	if (item?.type === "file_change") {
		return item.status === "completed"
			? "File edit completed"
			: "File edit started";
	}
	if (event.type === "item.started") return "Action started";
	if (event.type === "item.completed") return "Action completed";
	return event.type;
}

function formatChanges(changes: unknown) {
	if (!Array.isArray(changes)) return "";
	return changes
		.map((change) => {
			const entry: FileChangeEntry = isJsonObject(change) ? change : {};
			const path =
				typeof entry.path === "string"
					? (entry.path.split("/storefront/").pop() ?? entry.path)
					: "file";
			return `${entry.kind ?? "change"}: ${path}`;
		})
		.join("\n");
}

function codexEventText(event: CodexActivityInputEvent, maxChars: number) {
	const item = itemFor(event);
	if (
		event.type === "thread.started" &&
		typeof event.parsed.thread_id === "string"
	) {
		return `Started ${event.parsed.thread_id}`;
	}
	if (event.type === "turn.started") {
		return "Agent began the requested storefront work.";
	}
	if (item?.type === "command_execution") {
		const command =
			typeof item.command === "string"
				? formatShellCommandForDisplay(
						item.command.replace(/^\/bin\/zsh -lc /, ""),
					)
				: "shell command";
		const rawOutput =
			typeof item.aggregated_output === "string"
				? item.aggregated_output.trim()
				: "";
		if (!rawOutput) return command;
		if (rawOutput.length > CODEX_OUTPUT_PREVIEW_CHARS) {
			return `${command}\n(${rawOutput.length.toLocaleString()} chars of output — see Transcript tab)`;
		}
		return `${command}\n${rawOutput.slice(0, maxChars)}`;
	}
	if (item?.type === "file_change") {
		return formatChanges(item.changes) || "Source files changed.";
	}
	if (typeof item?.text === "string") return item.text;
	if (typeof item?.name === "string") return item.name;
	if (typeof event.parsed.message === "string") return event.parsed.message;
	return event.raw.trim().slice(0, maxChars) || labelForCodex(event);
}

export function codexEventsToActivityRows(
	events: CodexActivityInputEvent[],
	maxBodyChars: number,
): CodexActivityRow[] {
	return events.map((event) => ({
		id: event.id,
		label: labelForCodex(event),
		body: codexEventText(event, maxBodyChars),
		variant: "muted",
	}));
}
