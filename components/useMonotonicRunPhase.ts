"use client";

import { useEffect, useMemo, useRef } from "react";
import { isLiveRunStatus } from "@/components/RunLiveProvider";
import type { ActivityEventItem } from "@/components/ActivityLog";
import {
	inferRunPhase,
	maxPhaseId,
	runPhaseStateFor,
	type RunPhaseId,
	type RunPhaseState,
} from "@/lib/run-phase";

export function useMonotonicRunPhase({
	runId,
	status,
	agentCore,
	hasPreview,
	events,
}: {
	runId?: string;
	status: string;
	agentCore: string;
	hasPreview: boolean;
	events: ActivityEventItem[];
}): RunPhaseState {
	const computed = useMemo(
		() =>
			inferRunPhase({
				status,
				agentCore,
				hasPreview,
				events,
			}),
		[status, agentCore, hasPreview, events],
	);
	const peakRef = useRef<RunPhaseId>("starting");
	const runKeyRef = useRef(runId ?? "");

	useEffect(() => {
		if ((runId ?? "") !== runKeyRef.current) {
			runKeyRef.current = runId ?? "";
			peakRef.current = "starting";
		}
	}, [runId]);

	if (!isLiveRunStatus(status)) {
		peakRef.current = computed.id;
		return computed;
	}

	const id = maxPhaseId(peakRef.current, computed.id);
	peakRef.current = id;
	return runPhaseStateFor(id, computed.total);
}
