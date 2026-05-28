"use client";

import { useEffect, useState } from "react";
import { formatRunDuration } from "@/lib/agent-display";

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
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		if (status !== "running" && status !== "queued") return;
		const id = window.setInterval(() => setNow(new Date()), 1000);
		return () => window.clearInterval(id);
	}, [status]);

	const duration = formatRunDuration(
		startedAt,
		status === "running" ? null : completedAt,
		now,
	);

	return (
		<>
			{duration}
			{showElapsedSuffix ? " elapsed" : ""}
		</>
	);
}
