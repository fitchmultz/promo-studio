import { codexEventsToActivityRows } from "@/lib/codex-activity-view";
import { piEventsToActivityRows } from "@/lib/pi-activity-view";

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
	if (agentCore === "pi") {
		return piEventsToActivityRows(events, maxBodyChars, {
			demoLive,
			agentLabel,
		});
	}
	return codexEventsToActivityRows(events, maxBodyChars);
}
