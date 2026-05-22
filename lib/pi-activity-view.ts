/**
 * Maps Pi JSON CLI events to activity rows similar to the interactive TUI:
 * merged thinking/assistant prose, bash as `$ command`, edit/write/read with paths.
 */

export interface PiActivityInputEvent {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

export type PiActivityRowKind =
	| "session"
	| "lifecycle"
	| "thinking"
	| "assistant"
	| "tool"
	| "other";

export interface PiActivityRow {
	id: string;
	kind: PiActivityRowKind;
	label: string;
	body: string;
	/** prose = thinking/assistant; tool = monospace command block */
	variant: "prose" | "tool" | "muted";
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function piMessageUpdateKind(
	event: PiActivityInputEvent,
): "text" | "thinking" | "other" {
	const assistantEvent = event.parsed.assistantMessageEvent;
	if (!isJsonObject(assistantEvent)) return "other";
	if (assistantEvent.type === "text_delta") return "text";
	if (assistantEvent.type === "thinking_delta") return "thinking";
	return "other";
}

function piDeltaFromEvent(event: PiActivityInputEvent): string {
	const assistantEvent = event.parsed.assistantMessageEvent;
	if (!isJsonObject(assistantEvent) || typeof assistantEvent.delta !== "string") {
		return "";
	}
	return assistantEvent.delta;
}

function shortenWorkspacePath(path: string): string {
	const marker = "/storefront/";
	const index = path.indexOf(marker);
	if (index >= 0) return path.slice(index + marker.length);
	const runMarker = "/run-";
	const runIndex = path.indexOf(runMarker);
	if (runIndex >= 0) {
		const tail = path.slice(runIndex + 1);
		const slash = tail.indexOf("/");
		return slash >= 0 ? tail.slice(slash + 1) : tail;
	}
	return path.split("/").pop() ?? path;
}

function strArg(args: unknown, key: string): string | undefined {
	if (!isJsonObject(args)) return undefined;
	const value = args[key];
	return typeof value === "string" ? value : undefined;
}

/** Mirrors pi TUI `formatBashCall`: bold `$ command`. */
export function formatPiBashCall(args: unknown): string {
	const command = strArg(args, "command");
	if (!command?.trim()) return "$ …";
	const timeout = isJsonObject(args) ? args.timeout : undefined;
	const suffix =
		typeof timeout === "number" ? ` (timeout ${timeout}s)` : "";
	return `$ ${command.trim()}${suffix}`;
}

function formatPiToolCall(toolName: string, args: unknown): string {
	switch (toolName) {
		case "bash":
			return formatPiBashCall(args);
		case "edit": {
			const path = strArg(args, "path");
			return path ? `edit ${shortenWorkspacePath(path)}` : "edit";
		}
		case "write": {
			const path = strArg(args, "path");
			return path ? `write ${shortenWorkspacePath(path)}` : "write";
		}
		case "read": {
			const path = strArg(args, "path");
			return path ? `read ${shortenWorkspacePath(path)}` : "read";
		}
		case "grep":
		case "find":
		case "ls": {
			const path = strArg(args, "path") ?? strArg(args, "pattern");
			return path
				? `${toolName} ${shortenWorkspacePath(path)}`
				: toolName;
		}
		default:
			if (isJsonObject(args) && Object.keys(args).length > 0) {
				try {
					const compact = JSON.stringify(args);
					const preview =
						compact.length > 200 ? `${compact.slice(0, 200)}…` : compact;
					return `${toolName} ${preview}`;
				} catch {
					return toolName;
				}
			}
			return toolName;
	}
}

function toolResultText(result: unknown, maxChars: number): string {
	if (!isJsonObject(result)) return "";
	const content = result.content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (!isJsonObject(block)) continue;
		if (block.type === "text" && typeof block.text === "string") {
			parts.push(block.text);
		}
	}
	const joined = parts.join("\n").trim();
	if (!joined) return "";
	if (joined.length <= maxChars) return joined;
	return `${joined.slice(0, maxChars)}… (${joined.length.toLocaleString()} chars — see Transcript tab)`;
}

function lifecycleLabel(type: string): string | null {
	switch (type) {
		case "session":
			return "Session";
		case "agent_start":
			return "Agent started";
		case "agent_end":
			return "Agent finished";
		case "turn_start":
			return "Turn";
		case "turn_end":
			return "Turn finished";
		case "message_start":
			return null;
		case "message_end":
			return null;
		default:
			return null;
	}
}

function lifecycleBody(event: PiActivityInputEvent): string {
	if (event.type === "session") {
		const cwd = typeof event.parsed.cwd === "string" ? event.parsed.cwd : "";
		return cwd ? shortenWorkspacePath(cwd) : event.raw.trim();
	}
	if (event.type === "agent_end" && isJsonObject(event.parsed)) {
		const messages = event.parsed.messages;
		if (Array.isArray(messages)) {
			return `${messages.length} message(s) in session`;
		}
	}
	return "";
}

function pushMerged(
	out: PiActivityRow[],
	kind: "thinking" | "assistant",
	buffer: string,
	serial: number,
) {
	if (!buffer) return;
	out.push({
		id: `merged-${kind}-${serial}`,
		kind,
		label: kind === "thinking" ? "Thinking" : "Assistant",
		body: buffer,
		variant: "prose",
	});
}

const SKIP_TYPES = new Set([
	"message_start",
	"message_end",
	"tool_execution_update",
]);

/**
 * Convert raw Pi JSONL events into TUI-like activity rows (merge deltas, format tools).
 */
export function piEventsToActivityRows(
	events: PiActivityInputEvent[],
	maxBodyChars: number,
): PiActivityRow[] {
	const out: PiActivityRow[] = [];
	let textBuffer = "";
	let thinkingBuffer = "";
	let mergeSerial = 0;

	const flushText = () => {
		pushMerged(out, "assistant", textBuffer, mergeSerial++);
		textBuffer = "";
	};
	const flushThinking = () => {
		pushMerged(out, "thinking", thinkingBuffer, mergeSerial++);
		thinkingBuffer = "";
	};
	const flushAll = () => {
		flushText();
		flushThinking();
	};

	for (const event of events) {
		if (SKIP_TYPES.has(event.type)) continue;

		if (event.type === "message_update") {
			const kind = piMessageUpdateKind(event);
			if (kind === "text") {
				flushThinking();
				textBuffer += piDeltaFromEvent(event);
				continue;
			}
			if (kind === "thinking") {
				flushText();
				thinkingBuffer += piDeltaFromEvent(event);
				continue;
			}
			flushAll();
			const raw = event.raw.trim();
			if (raw) {
				out.push({
					id: event.id,
					kind: "other",
					label: "Message update",
					body: raw.slice(0, maxBodyChars),
					variant: "muted",
				});
			}
			continue;
		}

		flushAll();

		if (event.type === "tool_execution_start") {
			const toolName =
				typeof event.parsed.toolName === "string"
					? event.parsed.toolName
					: "tool";
			out.push({
				id: event.id,
				kind: "tool",
				label: "Tool",
				body: formatPiToolCall(toolName, event.parsed.args),
				variant: "tool",
			});
			continue;
		}

		if (event.type === "tool_execution_end") {
			const toolName =
				typeof event.parsed.toolName === "string"
					? event.parsed.toolName
					: "tool";
			const callLine = formatPiToolCall(toolName, event.parsed.args);
			const output = toolResultText(event.parsed.result, maxBodyChars);
			const isError = event.parsed.isError === true;
			const body = output ? `${callLine}\n${output}` : callLine;
			out.push({
				id: event.id,
				kind: "tool",
				label: isError ? "Tool failed" : "Tool done",
				body: body.slice(0, maxBodyChars * 2),
				variant: "tool",
			});
			continue;
		}

		const label = lifecycleLabel(event.type);
		if (label) {
			const body = lifecycleBody(event);
			out.push({
				id: event.id,
				kind: event.type === "session" ? "session" : "lifecycle",
				label,
				body: body || event.raw.trim().slice(0, maxBodyChars),
				variant: "muted",
			});
			continue;
		}

		const raw = event.raw.trim();
		if (raw) {
			out.push({
				id: event.id,
				kind: "other",
				label: event.type,
				body: raw.slice(0, maxBodyChars),
				variant: "muted",
			});
		}
	}

	flushAll();
	return out;
}
