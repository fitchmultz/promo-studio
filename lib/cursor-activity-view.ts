import { formatShellCommandForDisplay } from "@/lib/agent-display";
import { codexStyleToolLabel } from "@/lib/activity-labels";
import { shortenStorefrontPath } from "@/lib/activity-path";
import {
	classifyThinkingActionLine,
	extractThinkingActions,
	summarizeAssistantProse,
} from "@/lib/agent-activity-steps";
import { isJsonObject } from "@/lib/json";
import type { ActivityRow } from "@/lib/activity-view";

export interface CursorActivityInputEvent {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

const CURSOR_OUTPUT_PREVIEW_CHARS = 600;

function textFromAssistantContent(content: unknown): string {
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (!isJsonObject(block)) continue;
		if (block.type === "text" && typeof block.text === "string") {
			parts.push(block.text);
		}
	}
	return parts.join("").trim();
}

/** Prefer the longest assistant snapshot; streaming sends fragments then a full line. */
export function mergeAssistantStreamText(
	current: string,
	next: string,
): string {
	const value = next.trim();
	if (!value) return current;
	if (!current) return value;
	if (value.length >= current.length) return value;
	if (current.includes(value)) return current;
	if (value.includes(current)) return value;
	return `${current}${value}`;
}

function mergeThinkingStreamText(current: string, next: string): string {
	const value = next.trim();
	if (!value) return current;
	if (!current) return value;
	if (value.length >= current.length) return value;
	if (current.includes(value)) return current;
	if (value.includes(current)) return value;
	return `${current}\n${value}`;
}

function toolArgsDetail(args: unknown): string {
	if (!isJsonObject(args)) {
		return typeof args === "string" ? args : "";
	}
	if (typeof args.command === "string") {
		return formatShellCommandForDisplay(args.command);
	}
	if (typeof args.path === "string") {
		return shortenStorefrontPath(args.path);
	}
	if (typeof args.globPattern === "string") {
		const pattern = args.globPattern;
		const dir =
			typeof args.targetDirectory === "string"
				? shortenStorefrontPath(args.targetDirectory)
				: "";
		return dir ? `${pattern} (${dir})` : pattern;
	}
	if (typeof args.pattern === "string") {
		return args.pattern;
	}
	return "";
}

function toolCallRow(
	event: CursorActivityInputEvent,
	maxBodyChars: number,
): ActivityRow | null {
	const name =
		typeof event.parsed.name === "string" ? event.parsed.name : "tool";
	const phase = event.parsed.status === "completed" ? "end" : "start";
	const isError = event.parsed.status === "error";
	const command =
		isJsonObject(event.parsed.args) &&
		typeof event.parsed.args.command === "string"
			? event.parsed.args.command
			: undefined;
	const label = codexStyleToolLabel(name, phase, isError, command);
	const detail = toolArgsDetail(event.parsed.args);
	const body = detail ? `${label}\n${detail}`.slice(0, maxBodyChars) : label;
	if (!body) return null;
	const callId =
		typeof event.parsed.call_id === "string" ? event.parsed.call_id : event.id;
	return {
		id: `tool:${callId}`,
		label,
		body,
		variant: "tool",
	};
}

function statusBody(
	event: CursorActivityInputEvent,
	maxBodyChars: number,
): string {
	if (typeof event.parsed.message === "string" && event.parsed.message.trim()) {
		return event.parsed.message.trim().slice(0, maxBodyChars);
	}
	if (typeof event.parsed.status === "string") {
		return event.parsed.status;
	}
	return "";
}

export function cursorEventsToActivityRows(
	events: CursorActivityInputEvent[],
	maxBodyChars = CURSOR_OUTPUT_PREVIEW_CHARS,
	options: { demoLive?: boolean } = {},
): ActivityRow[] {
	const demoLive = options.demoLive !== false;
	const rows: ActivityRow[] = [];
	let thinkingBuffer = "";
	let assistantBuffer = "";
	let assistantSummary = "";
	const seenActions = new Set<string>();
	const toolRows = new Map<string, ActivityRow>();
	const toolOrder: string[] = [];
	let sawSystem = false;

	const flushThinking = () => {
		if (!thinkingBuffer.trim()) {
			thinkingBuffer = "";
			return;
		}
		if (demoLive) {
			for (const action of extractThinkingActions(thinkingBuffer)) {
				if (seenActions.has(action.action)) continue;
				seenActions.add(action.action);
				rows.push({
					id: `thinking:${action.action}`,
					label: action.action,
					body: action.action,
					variant: "muted",
				});
			}
			const classified = classifyThinkingActionLine(thinkingBuffer);
			if (classified && !seenActions.has(classified.action)) {
				seenActions.add(classified.action);
				rows.push({
					id: `thinking:${classified.action}`,
					label: classified.action,
					body: classified.action,
					variant: "muted",
				});
			}
		} else {
			rows.push({
				id: `thinking:${rows.length}`,
				label: "Thinking",
				body: thinkingBuffer.slice(0, maxBodyChars),
				variant: "muted",
			});
		}
		thinkingBuffer = "";
	};

	const flushAssistant = () => {
		if (!assistantBuffer.trim()) {
			assistantBuffer = "";
			return;
		}
		const prose = summarizeAssistantProse(assistantBuffer);
		if (!prose) {
			assistantBuffer = "";
			return;
		}
		if (demoLive) {
			if (prose !== assistantSummary) {
				assistantSummary = prose;
			}
		} else {
			rows.push({
				id: `assistant:${rows.length}`,
				label: prose.length > 60 ? `${prose.slice(0, 57)}…` : prose,
				body: prose.slice(0, maxBodyChars),
				variant: "prose",
			});
		}
		assistantBuffer = "";
	};

	for (const event of events) {
		if (event.type === "thinking" && typeof event.parsed.text === "string") {
			thinkingBuffer = mergeThinkingStreamText(
				thinkingBuffer,
				event.parsed.text,
			);
			continue;
		}
		flushThinking();

		if (event.type === "assistant") {
			const message = event.parsed.message;
			if (isJsonObject(message)) {
				assistantBuffer = mergeAssistantStreamText(
					assistantBuffer,
					textFromAssistantContent(message.content),
				);
			}
			continue;
		}
		flushAssistant();

		if (event.type === "tool_call") {
			const callId =
				typeof event.parsed.call_id === "string"
					? event.parsed.call_id
					: event.id;
			const row = toolCallRow(event, maxBodyChars);
			if (!row) continue;
			toolRows.set(callId, row);
			if (!toolOrder.includes(callId)) toolOrder.push(callId);
			continue;
		}

		if (event.type === "system" && event.parsed.subtype === "init") {
			if (sawSystem) continue;
			sawSystem = true;
			rows.push({
				id: event.id,
				label: "Cursor session",
				body: "Local Cursor SDK agent started in isolated storefront workspace.",
				variant: "muted",
			});
			continue;
		}

		if (event.type === "status") {
			const body = statusBody(event, maxBodyChars);
			if (!body) continue;
			const status = String(event.parsed.status ?? "");
			if (
				status === "RUNNING" &&
				rows.some((row) => row.id === "cursor-status-running")
			) {
				continue;
			}
			rows.push({
				id: status === "RUNNING" ? "cursor-status-running" : event.id,
				label: status === "FINISHED" ? "Cursor run finished" : "Cursor status",
				body,
				variant: "muted",
			});
		}
	}

	flushThinking();
	flushAssistant();
	if (demoLive && assistantSummary) {
		rows.push({
			id: "assistant:summary",
			label:
				assistantSummary.length > 60
					? `${assistantSummary.slice(0, 57)}…`
					: assistantSummary,
			body: assistantSummary.slice(0, maxBodyChars),
			variant: "prose",
		});
	}
	for (const callId of toolOrder) {
		const row = toolRows.get(callId);
		if (row) rows.push(row);
	}
	return rows;
}
