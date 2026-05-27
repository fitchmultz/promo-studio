"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityLog, type ActivityEventItem } from "@/components/ActivityLog";
import { RunPhaseStepper } from "@/components/RunPhaseStepper";
import { runAgentDisplayLabel } from "@/lib/agent-display";
import { inferRunPhase } from "@/lib/run-phase";
import { VariantRunPollSchema } from "@/lib/variant-run-api";

const LIVE_RUNNING_TEXT_LIMIT = 4000;
const LIVE_COMPLETED_TEXT_LIMIT = 12000;
const LIVE_RUNNING_CODEX_EVENTS = 200;
const LIVE_COMPLETED_CODEX_EVENTS = 400;
const LIVE_RUNNING_PI_ROWS = 120;
const LIVE_COMPLETED_PI_ROWS = 200;

export function ActivityStream({
	runId,
	agentCore = "codex",
	selectedModel = "",
	initialEvents = [],
	initialStatus = "running",
}: {
	runId: string;
	agentCore?: string;
	selectedModel?: string;
	initialEvents?: ActivityEventItem[];
	initialStatus?: string;
}) {
	const router = useRouter();
	const [events, setEvents] = useState(initialEvents);
	const [status, setStatus] = useState(initialStatus);
	const [hasPreview, setHasPreview] = useState(false);
	const activityListRef = useRef<HTMLOListElement>(null);
	const agentName = runAgentDisplayLabel({ agentCore, selectedModel });

	useEffect(() => {
		if (status !== "running") return undefined;
		let active = true;
		async function poll() {
			const response = await fetch(`/api/variant-runs/${runId}`, {
				cache: "no-store",
			});
			if (!active || !response.ok) return;
			const parsed = VariantRunPollSchema.safeParse(await response.json());
			if (!parsed.success) return;
			const payload = parsed.data;
			const nextStatus = payload.run.status;
			setEvents(payload.events);
			setStatus(nextStatus);
			setHasPreview(payload.run.hasPreview ?? false);
			if (nextStatus !== "running") router.refresh();
		}
		void poll();
		const timer = setInterval(() => void poll(), 1500);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [router, runId, status]);

	const textLimit =
		status === "running" ? LIVE_RUNNING_TEXT_LIMIT : LIVE_COMPLETED_TEXT_LIMIT;
	const maxVisibleEvents =
		status === "running"
			? LIVE_RUNNING_CODEX_EVENTS
			: LIVE_COMPLETED_CODEX_EVENTS;
	const maxVisiblePiRows =
		status === "running" ? LIVE_RUNNING_PI_ROWS : LIVE_COMPLETED_PI_ROWS;
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
			maxVisibleEvents={maxVisibleEvents}
			maxVisiblePiRows={maxVisiblePiRows}
			demoLive
			listRef={activityListRef}
			afterHeader={
				status === "running" ? <RunPhaseStepper phase={runPhase} /> : null
			}
			emptyMessage={`Waiting for ${agentName} to emit its first file read, edit, or command event.`}
		/>
	);
}
