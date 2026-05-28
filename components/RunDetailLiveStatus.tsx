"use client";

import { useOptionalRunLiveState } from "@/components/RunLiveProvider";
import { RunElapsed } from "@/components/RunElapsed";

export function RunDetailLiveStatus({
	initialStatus,
}: {
	initialStatus: string;
}) {
	const live = useOptionalRunLiveState();
	const status = live?.status ?? initialStatus;
	return (
		<span className={`status-pill status-pill--${status}`}>{status}</span>
	);
}

export function RunDetailLiveElapsed({
	startedAt,
	completedAt,
	initialStatus,
}: {
	startedAt: string;
	completedAt: string | null;
	initialStatus: string;
}) {
	const live = useOptionalRunLiveState();
	const status = live?.status ?? initialStatus;
	const showElapsed = status === "queued" || status === "running";
	return (
		<RunElapsed
			startedAt={startedAt}
			completedAt={completedAt}
			status={status}
			showElapsedSuffix={showElapsed}
		/>
	);
}
