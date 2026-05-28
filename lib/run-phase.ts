import { isJsonObject } from "@/lib/json";
import {
	cursorEventsToActivityRows,
	type CursorActivityInputEvent,
} from "@/lib/cursor-activity-view";
import {
	piEventsToActivityRows,
	type PiActivityInputEvent,
} from "@/lib/pi-activity-view";

export type RunPhaseId =
	| "starting"
	| "discovering"
	| "editing"
	| "testing"
	| "building"
	| "manifest"
	| "preview"
	| "failed";

export interface RunPhaseState {
	id: RunPhaseId;
	label: string;
	/** 1-based index for display */
	step: number;
	total: number;
}

const PHASE_ORDER: RunPhaseId[] = [
	"starting",
	"discovering",
	"editing",
	"testing",
	"building",
	"manifest",
	"preview",
];

const PHASE_LABELS: Record<RunPhaseId, string> = {
	starting: "Starting agent",
	discovering: "Discovering workspace",
	editing: "Editing storefront",
	testing: "Running tests",
	building: "Building preview",
	manifest: "Writing manifest",
	preview: "Preview ready",
	failed: "Run failed",
};

function phaseIndex(id: RunPhaseId): number {
	const index = PHASE_ORDER.indexOf(id);
	return index >= 0 ? index + 1 : 1;
}

export function maxPhaseId(a: RunPhaseId, b: RunPhaseId): RunPhaseId {
	return phaseIndex(a) >= phaseIndex(b) ? a : b;
}

export function runPhaseStateFor(
	id: RunPhaseId,
	total = PHASE_ORDER.length - 1,
): RunPhaseState {
	return {
		id,
		label: PHASE_LABELS[id],
		step: phaseIndex(id),
		total,
	};
}

/** Activity-only text — excludes prompts that mention artifact/manifest.json. */
function inferFromActivityText(text: string): RunPhaseId {
	const lower = text.toLowerCase();
	if (
		/\b(write|edit)\s+\S*manifest\.json/i.test(text) ||
		/\$\s*.*artifact\/manifest\.json/i.test(lower) ||
		/\b(cat|tee|echo)\b.*manifest\.json/i.test(lower)
	) {
		return "manifest";
	}
	if (lower.includes("npm run build")) return "building";
	if (lower.includes("npm test")) return "testing";
	if (/\bedit\s+\S/.test(lower) || /\bwrite\s+\S/.test(lower)) return "editing";
	if (
		/\bread\s+\S/.test(lower) ||
		/\$ glob/.test(lower) ||
		/\bls\b/.test(lower)
	)
		return "discovering";
	return "starting";
}

function piToolCommand(event: { parsed: Record<string, unknown> }): string {
	const args = event.parsed.args;
	if (!isJsonObject(args)) return "";
	if (typeof args.command === "string") return args.command;
	if (typeof args.path === "string") {
		const toolName =
			typeof event.parsed.toolName === "string" ? event.parsed.toolName : "";
		return `${toolName} ${args.path}`.trim();
	}
	return "";
}

function phaseForCodexEvent(event: {
	parsed: Record<string, unknown>;
}): RunPhaseId {
	const item = event.parsed.item;
	const itemType =
		typeof item === "object" && item !== null && "type" in item
			? String((item as { type?: unknown }).type)
			: "";
	if (itemType === "file_change") return "editing";
	if (itemType === "command_execution") {
		const command =
			typeof item === "object" &&
			item !== null &&
			"command" in item &&
			typeof (item as { command?: unknown }).command === "string"
				? (item as { command: string }).command
				: "";
		if (command.includes("npm run build")) return "building";
		if (command.includes("npm test")) return "testing";
		if (/\bmanifest\.json\b/i.test(command)) return "manifest";
		const inferred = inferFromActivityText(command);
		return inferred !== "starting" || !command.trim()
			? inferred
			: "discovering";
	}
	return "starting";
}

function inferFromCodexEvents(
	events: Array<{ type: string; parsed: Record<string, unknown> }>,
): RunPhaseId {
	let phase: RunPhaseId = "starting";
	for (const event of events) {
		phase = maxPhaseId(phase, phaseForCodexEvent(event));
	}
	return phase;
}

function cursorToolText(event: {
	type: string;
	parsed: Record<string, unknown>;
}): string {
	if (event.type !== "tool_call") return "";
	const name = typeof event.parsed.name === "string" ? event.parsed.name : "";
	const args = event.parsed.args;
	if (!isJsonObject(args)) return name;
	if (typeof args.command === "string") return args.command;
	if (typeof args.path === "string") return `${name} ${args.path}`.trim();
	return name;
}

function inferFromCursorEvents(
	events: Array<{
		type: string;
		parsed: Record<string, unknown>;
		raw?: string;
	}>,
): RunPhaseId {
	let phase: RunPhaseId = "starting";
	for (const event of events) {
		if (event.type === "thinking" && typeof event.parsed.text === "string") {
			phase = maxPhaseId(phase, inferFromActivityText(event.parsed.text));
		}
		const toolText = cursorToolText(event);
		if (toolText) phase = maxPhaseId(phase, inferFromActivityText(toolText));
	}
	const rows = cursorEventsToActivityRows(
		events as CursorActivityInputEvent[],
		4000,
	).filter((row) => row.variant === "tool");
	for (const row of rows) {
		phase = maxPhaseId(
			phase,
			inferFromActivityText(`${row.label}\n${row.body}`),
		);
	}
	return phase;
}

function inferFromPiEvents(
	events: Array<{
		type: string;
		parsed: Record<string, unknown>;
		raw?: string;
	}>,
): RunPhaseId {
	let phase: RunPhaseId = "starting";
	for (const event of events) {
		if (
			event.type !== "tool_execution_start" &&
			event.type !== "tool_execution_end"
		) {
			continue;
		}
		const command = piToolCommand(event);
		const toolName =
			typeof event.parsed.toolName === "string" ? event.parsed.toolName : "";
		const text = [command, toolName && toolName !== "bash" ? toolName : ""]
			.filter(Boolean)
			.join("\n");
		if (text) phase = maxPhaseId(phase, inferFromActivityText(text));
	}
	const rows = piEventsToActivityRows(events as PiActivityInputEvent[], 4000, {
		demoLive: true,
	}).filter((row) => row.kind === "tool");
	for (const row of rows) {
		phase = maxPhaseId(
			phase,
			inferFromActivityText(`${row.label}\n${row.body}`),
		);
	}
	return phase;
}

export function inferRunPhase(params: {
	status: string;
	agentCore: string;
	hasPreview: boolean;
	events: Array<{
		type: string;
		parsed: Record<string, unknown>;
		raw?: string;
	}>;
}): RunPhaseState {
	if (params.status === "failed") {
		return {
			id: "failed",
			label: PHASE_LABELS.failed,
			step: 1,
			total: 1,
		};
	}
	if (params.status === "succeeded" && params.hasPreview) {
		return {
			id: "preview",
			label: PHASE_LABELS.preview,
			step: PHASE_ORDER.length,
			total: PHASE_ORDER.length,
		};
	}
	if (params.status !== "running" && params.status !== "queued") {
		return {
			id: "preview",
			label: "Run finished",
			step: PHASE_ORDER.length - 1,
			total: PHASE_ORDER.length,
		};
	}
	if (params.status === "queued") {
		return {
			id: "starting",
			label: PHASE_LABELS.starting,
			step: 1,
			total: PHASE_ORDER.length - 1,
		};
	}

	const total = PHASE_ORDER.length - 1;
	const id =
		params.agentCore === "cursor"
			? inferFromCursorEvents(params.events)
			: params.agentCore === "pi"
				? inferFromPiEvents(params.events)
				: inferFromCodexEvents(params.events);

	return runPhaseStateFor(id, total);
}
