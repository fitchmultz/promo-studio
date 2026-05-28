/**
 * Maps Pi JSON CLI events to demo-friendly activity rows (Codex-parity step labels).
 * Raw JSONL stays on the Transcript tab only.
 */

import { formatShellCommandForDisplay } from "@/lib/agent-display";
import { codexStyleToolLabel } from "@/lib/activity-labels";
import { shortenStorefrontPath } from "@/lib/activity-path";
import { isJsonObject } from "@/lib/json";
import {
	extractThinkingActions,
	labelForPiActionEnd,
	labelForPiActionStart,
	type PiThinkingAction,
	summarizeAssistantProse,
} from "@/lib/pi-activity-steps";

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
	variant: "prose" | "tool" | "muted";
}

export interface PiActivityViewOptions {
	/** When true (default), live stream shows actionable steps only — no essay blocks or raw JSON. */
	demoLive?: boolean;
	/** User-facing agent label (e.g. Composer 2.5); defaults to Pi. */
	agentLabel?: string;
}

function piMessageUpdateKind(
	event: PiActivityInputEvent,
): "text" | "thinking" | "other" {
	const assistantEvent = event.parsed.assistantMessageEvent;
	if (!isJsonObject(assistantEvent)) return "other";
	const updateType = assistantEvent.type;
	if (
		updateType === "text_delta" ||
		updateType === "text_start" ||
		updateType === "text_end"
	) {
		return "text";
	}
	if (
		updateType === "thinking_delta" ||
		updateType === "thinking_start" ||
		updateType === "thinking_end"
	) {
		return "thinking";
	}
	return "other";
}

function piPartialProseFromEvent(event: PiActivityInputEvent): string {
	const assistantEvent = event.parsed.assistantMessageEvent;
	if (!isJsonObject(assistantEvent)) return "";
	const partial = assistantEvent.partial ?? event.parsed.message;
	if (!isJsonObject(partial)) return "";
	const content = partial.content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (!isJsonObject(block)) continue;
		if (block.type === "thinking" && typeof block.thinking === "string") {
			parts.push(block.thinking);
		}
		if (block.type === "text" && typeof block.text === "string") {
			parts.push(block.text);
		}
	}
	return parts.join("\n\n");
}

function piDeltaFromEvent(event: PiActivityInputEvent): string {
	const assistantEvent = event.parsed.assistantMessageEvent;
	if (
		!isJsonObject(assistantEvent) ||
		typeof assistantEvent.delta !== "string"
	) {
		return "";
	}
	return assistantEvent.delta;
}

function appendPiThinkingBuffer(
	buffer: string,
	event: PiActivityInputEvent,
): string {
	const snapshot = piPartialProseFromEvent(event);
	if (snapshot && snapshot.length >= buffer.length) return snapshot;
	const delta = piDeltaFromEvent(event);
	return delta ? buffer + delta : buffer;
}

function appendPiTextBuffer(
	buffer: string,
	event: PiActivityInputEvent,
): string {
	const snapshot = piPartialProseFromEvent(event);
	if (snapshot && snapshot.length >= buffer.length) return snapshot;
	const delta = piDeltaFromEvent(event);
	return delta ? buffer + delta : buffer;
}

function strArg(args: unknown, key: string): string | undefined {
	if (!isJsonObject(args)) return undefined;
	const value = args[key];
	return typeof value === "string" ? value : undefined;
}

/** Mirrors pi TUI `formatBashCall`: `$ command` with agent-workspaces paths. */
export function formatPiBashCall(args: unknown): string {
	const command = strArg(args, "command");
	if (!command?.trim()) return "$ …";
	const timeout = isJsonObject(args) ? args.timeout : undefined;
	const suffix = typeof timeout === "number" ? ` (timeout ${timeout}s)` : "";
	return `${formatShellCommandForDisplay(command)}${suffix}`;
}

function formatPiToolCall(toolName: string, args: unknown): string {
	switch (toolName) {
		case "bash":
			return formatPiBashCall(args);
		case "edit": {
			const path = strArg(args, "path");
			return path ? `edit ${shortenStorefrontPath(path)}` : "edit";
		}
		case "write": {
			const path = strArg(args, "path");
			return path ? `write ${shortenStorefrontPath(path)}` : "write";
		}
		case "read": {
			const path = strArg(args, "path");
			return path ? `read ${shortenStorefrontPath(path)}` : "read";
		}
		case "grep":
		case "find":
		case "ls": {
			const path = strArg(args, "path") ?? strArg(args, "pattern");
			return path ? `${toolName} ${shortenStorefrontPath(path)}` : toolName;
		}
		default:
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
	return `(${joined.length.toLocaleString()} chars — see Transcript tab)`;
}

const SKIP_TYPES = new Set([
	"message_start",
	"message_end",
	"tool_execution_update",
]);

function emitThinkingStepPair(
	out: PiActivityRow[],
	action: PiThinkingAction,
	seen: Set<string>,
	serial: number,
) {
	const key = `${action.kind}:${action.action}`;
	if (seen.has(key)) return;
	seen.add(key);
	out.push({
		id: `pi-step-start-${serial}-${seen.size}`,
		kind: "tool",
		label: labelForPiActionStart(action),
		body: action.action,
		variant: "tool",
	});
	if (
		action.kind === "edit" ||
		action.kind === "write" ||
		action.kind === "shell"
	) {
		out.push({
			id: `pi-step-end-${serial}-${seen.size}`,
			kind: "tool",
			label: labelForPiActionEnd(action),
			body: action.action,
			variant: "tool",
		});
	}
}

function emitThinkingAsSteps(
	out: PiActivityRow[],
	buffer: string,
	seen: Set<string>,
	serial: number,
) {
	for (const action of extractThinkingActions(buffer)) {
		emitThinkingStepPair(out, action, seen, serial);
	}
}

function pushMergedProse(
	out: PiActivityRow[],
	kind: "thinking" | "assistant",
	buffer: string,
	serial: number,
) {
	if (!buffer.trim()) return;
	out.push({
		id: `merged-${kind}-${serial}`,
		kind,
		label: kind === "thinking" ? "Thinking" : "Assistant",
		body: buffer,
		variant: "prose",
	});
}

/**
 * Convert Pi JSONL events into activity rows for the live stream.
 */
export function piEventsToActivityRows(
	events: PiActivityInputEvent[],
	maxBodyChars: number,
	options: PiActivityViewOptions = {},
): PiActivityRow[] {
	const demoLive = options.demoLive !== false;
	const agentLabel = options.agentLabel?.trim() || "Pi";
	const out: PiActivityRow[] = [];
	let textBuffer = "";
	let thinkingBuffer = "";
	let mergeSerial = 0;
	const seenActions = new Set<string>();
	let assistantSummary = "";

	const flushText = () => {
		if (!textBuffer) return;
		if (demoLive) {
			const summary = summarizeAssistantProse(textBuffer);
			if (summary && summary !== assistantSummary) {
				assistantSummary = summary;
			}
		} else {
			pushMergedProse(out, "assistant", textBuffer, mergeSerial++);
		}
		textBuffer = "";
	};
	const flushThinking = () => {
		if (!thinkingBuffer) return;
		if (demoLive) {
			emitThinkingAsSteps(out, thinkingBuffer, seenActions, mergeSerial++);
		} else {
			pushMergedProse(out, "thinking", thinkingBuffer, mergeSerial++);
		}
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
				textBuffer = appendPiTextBuffer(textBuffer, event);
				continue;
			}
			if (kind === "thinking") {
				flushText();
				thinkingBuffer = appendPiThinkingBuffer(thinkingBuffer, event);
				continue;
			}
			continue;
		}

		flushAll();

		if (event.type === "tool_execution_start") {
			const toolName =
				typeof event.parsed.toolName === "string"
					? event.parsed.toolName
					: "tool";
			const command = strArg(event.parsed.args, "command");
			const body = formatPiToolCall(toolName, event.parsed.args);
			const dedupeKey = `${toolName}:${body}`;
			if (demoLive && seenActions.has(dedupeKey)) continue;
			seenActions.add(dedupeKey);
			out.push({
				id: event.id,
				kind: "tool",
				label: codexStyleToolLabel(toolName, "start", false, command),
				body,
				variant: "tool",
			});
			continue;
		}

		if (event.type === "tool_execution_end") {
			const toolName =
				typeof event.parsed.toolName === "string"
					? event.parsed.toolName
					: "tool";
			const command = strArg(event.parsed.args, "command");
			const callLine = formatPiToolCall(toolName, event.parsed.args);
			const output = toolResultText(event.parsed.result, 400);
			const isError = event.parsed.isError === true;
			const body = output ? `${callLine}\n${output}` : callLine;
			const dedupeKey = `end:${toolName}:${callLine}`;
			if (demoLive && seenActions.has(dedupeKey)) continue;
			seenActions.add(dedupeKey);
			out.push({
				id: event.id,
				kind: "tool",
				label: codexStyleToolLabel(toolName, "end", isError, command),
				body: body.slice(0, maxBodyChars),
				variant: "tool",
			});
			continue;
		}

		if (demoLive) {
			if (event.type === "session") continue;
			if (event.type === "turn_start" || event.type === "turn_end") continue;
			if (event.type === "agent_start") {
				out.push({
					id: event.id,
					kind: "lifecycle",
					label: `${agentLabel} agent started`,
					body: "Running pi --mode json in isolated storefront workspace",
					variant: "muted",
				});
				continue;
			}
			if (event.type === "agent_end") continue;
			continue;
		}

		if (event.type === "session") {
			const cwd = typeof event.parsed.cwd === "string" ? event.parsed.cwd : "";
			out.push({
				id: event.id,
				kind: "session",
				label: "Session",
				body: cwd ? shortenStorefrontPath(cwd) : "",
				variant: "muted",
			});
			continue;
		}

		if (event.type === "agent_start") {
			out.push({
				id: event.id,
				kind: "lifecycle",
				label: "Agent started",
				body: "",
				variant: "muted",
			});
			continue;
		}

		const raw = event.raw.trim();
		if (raw.startsWith("{") && demoLive) continue;
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
	if (demoLive && assistantSummary) {
		out.push({
			id: "assistant-summary-final",
			kind: "assistant",
			label: "Agent message",
			body: assistantSummary,
			variant: "muted",
		});
	}
	return out;
}
