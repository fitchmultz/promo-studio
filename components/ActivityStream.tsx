"use client";

import { useMemo, useRef, useEffect } from "react";
import { ActivityLog, type ActivityEventItem } from "@/components/ActivityLog";
import {
	isLiveRunStatus,
	useOptionalRunLiveState,
} from "@/components/RunLiveProvider";
import { RunPhaseStepper } from "@/components/RunPhaseStepper";
import { runAgentDisplayLabel } from "@/lib/agent-display";
import { inferRunPhase } from "@/lib/run-phase";

const LIVE_RUNNING_TEXT_LIMIT = 4000;
const LIVE_COMPLETED_TEXT_LIMIT = 12000;
const LIVE_RUNNING_ROWS = 200;
const LIVE_COMPLETED_ROWS = 400;

export function ActivityStream({
	agentCore = "codex",
	selectedModel = "",
	initialEvents = [],
	initialStatus = "running",
}: {
	runId?: string;
	agentCore?: string;
	selectedModel?: string;
	initialEvents?: ActivityEventItem[];
	initialStatus?: string;
}) {
	const liveState = useOptionalRunLiveState();
	const events = liveState?.events ?? initialEvents;
	const status = liveState?.status ?? initialStatus;
	const hasPreview = liveState?.hasPreview ?? false;
	const activityListRef = useRef<HTMLOListElement>(null);
	const agentName = runAgentDisplayLabel({ agentCore, selectedModel });

	const live = isLiveRunStatus(status);
	const textLimit = live ? LIVE_RUNNING_TEXT_LIMIT : LIVE_COMPLETED_TEXT_LIMIT;
	const maxVisibleRows = live ? LIVE_RUNNING_ROWS : LIVE_COMPLETED_ROWS;
	const scrollAnchor = `${events.at(-1)?.id ?? ""}:${events.at(-1)?.raw.length ?? 0}`;
	const runPhase = useMemo(
		() =>
			inferRunPhase({
				status,
				agentCore,
				hasPreview,
				events,
			}),
		[status, agentCore, hasPreview, events],
	);

	useEffect(() => {
		const activityList = activityListRef.current;
		if (!activityList || !scrollAnchor) return;
		activityList.scrollTop = activityList.scrollHeight;
	}, [scrollAnchor]);

	return (
		<ActivityLog
			titleId="activity-title"
			kicker="Live agent stream"
			agentName={agentName}
			agentCore={agentCore}
			status={status}
			events={events}
			textLimit={textLimit}
			maxVisibleRows={maxVisibleRows}
			demoLive
			listRef={activityListRef}
			afterHeader={live ? <RunPhaseStepper phase={runPhase} /> : null}
			emptyMessage={`Waiting for ${agentName} to emit its first file read, edit, or command event.`}
		/>
	);
}
