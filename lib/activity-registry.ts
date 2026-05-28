import { codexEventsToActivityRows } from "@/lib/codex-activity-view";
import { cursorEventsToActivityRows } from "@/lib/cursor-activity-view";
import { piEventsToActivityRows } from "@/lib/pi-activity-view";
import type { ActivityInputEvent, ActivityRow } from "@/lib/activity-view";

export interface ActivityRenderOptions {
	agentLabel: string;
	events: ActivityInputEvent[];
	maxBodyChars: number;
	demoLive: boolean;
}

export const ACTIVITY_ROW_RENDERERS: Record<
	string,
	(options: ActivityRenderOptions) => ActivityRow[]
> = {
	codex: ({ events, maxBodyChars }: ActivityRenderOptions): ActivityRow[] =>
		codexEventsToActivityRows(events, maxBodyChars),
	pi: ({
		events,
		maxBodyChars,
		demoLive,
		agentLabel,
	}: ActivityRenderOptions): ActivityRow[] =>
		piEventsToActivityRows(events, maxBodyChars, { demoLive, agentLabel }),
	cursor: ({
		events,
		maxBodyChars,
		demoLive,
	}: ActivityRenderOptions): ActivityRow[] =>
		cursorEventsToActivityRows(events, maxBodyChars, { demoLive }),
};

export function activityRowsForCore(
	agentCore: string | undefined,
	options: ActivityRenderOptions,
) {
	return (
		ACTIVITY_ROW_RENDERERS[agentCore ?? ""] ?? ACTIVITY_ROW_RENDERERS.codex
	)(options);
}
