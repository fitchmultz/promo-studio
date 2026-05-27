"use client";

import { useRouter } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { ActivityEventItem } from "@/components/ActivityLog";
import { VariantRunPollSchema } from "@/lib/variant-run-api";

export function isLiveRunStatus(status: string) {
	return status === "queued" || status === "running";
}

interface RunLiveState {
	runId: string;
	status: string;
	events: ActivityEventItem[];
	hasPreview: boolean;
}

const RunLiveContext = createContext<RunLiveState | null>(null);

export function RunLiveProvider({
	runId,
	initialStatus,
	initialEvents,
	initialHasPreview,
	children,
}: {
	runId: string;
	initialStatus: string;
	initialEvents: ActivityEventItem[];
	initialHasPreview: boolean;
	children?: ReactNode;
}) {
	const router = useRouter();
	const [status, setStatus] = useState(initialStatus);
	const [events, setEvents] = useState(initialEvents);
	const [hasPreview, setHasPreview] = useState(initialHasPreview);

	useEffect(() => {
		setStatus(initialStatus);
		setEvents(initialEvents);
		setHasPreview(initialHasPreview);
	}, [initialEvents, initialHasPreview, initialStatus]);

	useEffect(() => {
		if (!isLiveRunStatus(status)) return undefined;
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
			if (!isLiveRunStatus(nextStatus)) router.refresh();
		}
		void poll();
		const timer = setInterval(() => void poll(), 1500);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [router, runId, status]);

	const value = useMemo(
		() => ({ runId, status, events, hasPreview }),
		[runId, status, events, hasPreview],
	);

	return (
		<RunLiveContext.Provider value={value}>{children}</RunLiveContext.Provider>
	);
}

export function useOptionalRunLiveState() {
	return useContext(RunLiveContext);
}

export function useRunLiveState() {
	const context = useOptionalRunLiveState();
	if (!context) {
		throw new Error("useRunLiveState must be used within RunLiveProvider");
	}
	return context;
}
