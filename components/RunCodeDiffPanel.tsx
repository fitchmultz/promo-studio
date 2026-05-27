"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChangedFilesList, DiffList } from "@/components/DiffList";
import {
	isLiveRunStatus,
	useOptionalRunLiveState,
} from "@/components/RunLiveProvider";
import type { DiffEntry } from "@/lib/diff";
import { RunDiffResponseSchema } from "@/lib/variant-run-api";

export function RunCodeDiffPanel({
	runId,
	initialStatus,
	initialChangedFiles,
	completedDiff,
}: {
	runId: string;
	initialStatus: string;
	initialChangedFiles: string[];
	completedDiff?: ReactNode;
}) {
	const router = useRouter();
	const liveState = useOptionalRunLiveState();
	const status = liveState?.status ?? initialStatus;
	const [changedFiles, setChangedFiles] = useState(initialChangedFiles);
	const [liveDiffs, setLiveDiffs] = useState<DiffEntry[]>([]);

	useEffect(() => {
		setChangedFiles(initialChangedFiles);
	}, [initialChangedFiles]);

	useEffect(() => {
		if (!isLiveRunStatus(status)) return undefined;
		let active = true;

		async function pollDiff() {
			const response = await fetch(`/api/variant-runs/${runId}/diff`, {
				cache: "no-store",
			});
			if (!active || !response.ok) return;
			const parsed = RunDiffResponseSchema.safeParse(await response.json());
			if (!parsed.success) return;
			const payload = parsed.data;
			setChangedFiles(payload.changedFiles);
			setLiveDiffs(payload.diffs);
			if (!isLiveRunStatus(payload.status)) router.refresh();
		}

		void pollDiff();
		const timer = setInterval(() => void pollDiff(), 2500);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [router, runId, status]);

	if (!isLiveRunStatus(status) && completedDiff) {
		return completedDiff;
	}

	if (!isLiveRunStatus(status) && !changedFiles.length) {
		return <p className="muted">No code changes were detected for this run.</p>;
	}

	if (isLiveRunStatus(status) && !changedFiles.length) {
		return (
			<p className="muted">
				Watching the workspace for file changes. Edits will appear here as the
				agent works.
			</p>
		);
	}

	return (
		<>
			<ChangedFilesList files={changedFiles} />
			{isLiveRunStatus(status) ? (
				liveDiffs.length ? (
					<DiffList diffs={liveDiffs} />
				) : (
					<p className="muted">Loading line-level diffs…</p>
				)
			) : null}
		</>
	);
}
