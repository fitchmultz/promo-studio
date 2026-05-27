"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChangedFilesList, DiffList } from "@/components/DiffList";
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
	const [status, setStatus] = useState(initialStatus);
	const [changedFiles, setChangedFiles] = useState(initialChangedFiles);
	const [liveDiffs, setLiveDiffs] = useState<DiffEntry[]>([]);

	useEffect(() => {
		setStatus(initialStatus);
		setChangedFiles(initialChangedFiles);
	}, [initialChangedFiles, initialStatus]);

	useEffect(() => {
		if (status !== "running") return undefined;
		let active = true;

		async function pollDiff() {
			const response = await fetch(`/api/variant-runs/${runId}/diff`, {
				cache: "no-store",
			});
			if (!active || !response.ok) return;
			const parsed = RunDiffResponseSchema.safeParse(await response.json());
			if (!parsed.success) return;
			const payload = parsed.data;
			setStatus(payload.status);
			setChangedFiles(payload.changedFiles);
			setLiveDiffs(payload.diffs);
			if (payload.status !== "running") router.refresh();
		}

		void pollDiff();
		const timer = setInterval(() => void pollDiff(), 2500);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [router, runId, status]);

	if (status !== "running" && completedDiff) {
		return completedDiff;
	}

	if (status !== "running" && !changedFiles.length) {
		return <p className="muted">No code changes were detected for this run.</p>;
	}

	if (status === "running" && !changedFiles.length) {
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
			{status === "running" ? (
				liveDiffs.length ? (
					<DiffList diffs={liveDiffs} />
				) : (
					<p className="muted">Loading line-level diffs…</p>
				)
			) : null}
		</>
	);
}
