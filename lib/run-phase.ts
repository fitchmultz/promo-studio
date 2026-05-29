import { agentActionsFromEvents, type AgentAction } from "@/lib/agent-actions";

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

function phaseForAction(action: AgentAction): RunPhaseId {
	if (action.kind === "manifest") return "manifest";
	if (action.kind === "build") return "building";
	if (action.kind === "test") return "testing";
	if (action.kind === "edit") return "editing";
	if (action.kind === "read") return "discovering";
	return "starting";
}

function inferFromActions(actions: AgentAction[]): RunPhaseId {
	let phase: RunPhaseId = "starting";
	for (const action of actions) {
		phase = maxPhaseId(phase, phaseForAction(action));
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
	const actions = agentActionsFromEvents(params.agentCore, params.events);
	return runPhaseStateFor(inferFromActions(actions), total);
}
