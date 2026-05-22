import type { PiActivityInputEvent } from "@/lib/pi-activity-view";

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

function inferFromTranscriptText(text: string): RunPhaseId {
	const lower = text.toLowerCase();
	if (lower.includes("artifact/manifest.json") || lower.includes("manifest.json"))
		return "manifest";
	if (lower.includes("npm run build")) return "building";
	if (lower.includes("npm test")) return "testing";
	if (/\bedit\s+\S/.test(lower) || /\bwrite\s+\S/.test(lower)) return "editing";
	if (/\bread\s+\S/.test(lower) || /\$ glob/.test(lower) || /\bls\b/.test(lower))
		return "discovering";
	return "starting";
}

function inferFromCodexEvents(
	events: Array<{ type: string; parsed: Record<string, unknown> }>,
): RunPhaseId {
	let phase: RunPhaseId = "starting";
	for (const event of events) {
		const item = event.parsed.item;
		const itemType =
			typeof item === "object" && item !== null && "type" in item
				? String((item as { type?: unknown }).type)
				: "";
		if (itemType === "file_change") phase = "editing";
		if (itemType === "command_execution") {
			const command =
				typeof item === "object" &&
				item !== null &&
				"command" in item &&
				typeof (item as { command?: unknown }).command === "string"
					? (item as { command: string }).command
					: "";
			if (command.includes("npm run build")) phase = "building";
			else if (command.includes("npm test")) phase = "testing";
			else if (command.includes("manifest")) phase = "manifest";
			else phase = inferFromTranscriptText(command);
		}
	}
	return phase;
}

export function inferRunPhase(params: {
	status: string;
	agentCore: string;
	hasPreview: boolean;
	events: Array<{ type: string; parsed: Record<string, unknown>; raw?: string }>;
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
	if (params.status !== "running") {
		return {
			id: "preview",
			label: "Run finished",
			step: PHASE_ORDER.length - 1,
			total: PHASE_ORDER.length,
		};
	}

	let id: RunPhaseId = "starting";
	if (params.agentCore === "pi") {
		const joined = params.events.map((e) => e.raw ?? JSON.stringify(e.parsed)).join("\n");
		id = inferFromTranscriptText(joined);
	} else {
		id = inferFromCodexEvents(params.events);
	}

	return {
		id,
		label: PHASE_LABELS[id],
		step: phaseIndex(id),
		total: PHASE_ORDER.length - 1,
	};
}

export function inferRunPhaseFromPiEvents(
	status: string,
	hasPreview: boolean,
	events: PiActivityInputEvent[],
): RunPhaseState {
	return inferRunPhase({
		status,
		agentCore: "pi",
		hasPreview,
		events,
	});
}
