"use client";

import { useEffect, useState } from "react";
import { formatRunDuration } from "@/lib/agent-display";

export function isLiveRunStatus(status: string) {
	return status === "running" || status === "queued";
}

export function RunElapsed({
	startedAt,
	completedAt,
	status,
	showElapsedSuffix = false,
}: {
	startedAt: string;
	completedAt: string | null;
	status: string;
	showElapsedSuffix?: boolean;
}) {
	const isLive = isLiveRunStatus(status);
	const [tick, setTick] = useState<Date | null>(null);

	useEffect(() => {
		if (!isLive) return;
		setTick(new Date());
		const id = window.setInterval(() => setTick(new Date()), 1000);
		return () => window.clearInterval(id);
	}, [isLive, status]);

	if (isLive && !tick) {
		return (
			<>
				<span className="run-elapsed-pending" aria-hidden>
					…
				</span>
				{showElapsedSuffix ? " elapsed" : ""}
			</>
		);
	}

	const duration = formatRunDuration(
		startedAt,
		isLive ? null : completedAt,
		tick ?? undefined,
	);

	return (
		<>
			{duration}
			{showElapsedSuffix ? " elapsed" : ""}
		</>
	);
}
