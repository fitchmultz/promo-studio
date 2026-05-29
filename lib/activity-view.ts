import { activityRowsForCore } from "@/lib/activity-registry";

export interface ActivityInputEvent {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

export interface ActivityRow {
	id: string;
	label: string;
	body: string;
	variant: "prose" | "tool" | "muted";
}

export function agentEventsToActivityRows({
	agentCore,
	agentLabel,
	events,
	maxBodyChars,
	demoLive,
}: {
	agentCore?: string;
	agentLabel: string;
	events: ActivityInputEvent[];
	maxBodyChars: number;
	demoLive: boolean;
}): ActivityRow[] {
	return activityRowsForCore(agentCore, {
		agentLabel,
		events,
		maxBodyChars,
		demoLive,
	});
}
