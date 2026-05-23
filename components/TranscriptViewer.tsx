"use client";

import { useCallback, useEffect, useState } from "react";
import { VirtualizedTranscript } from "@/components/VirtualizedTranscript";
import { runAgentDisplayLabel } from "@/lib/agent-display";

const INITIAL_TAIL_LINES = 120;
const LOAD_MORE_STEP = 120;
const MAX_TAIL_LINES = 800;

export function TranscriptViewer({
	runId,
	agentCore,
	selectedModel = "",
	invocation,
}: {
	runId: string;
	agentCore: string;
	selectedModel?: string;
	invocation: string;
}) {
	const agentLabel = runAgentDisplayLabel({ agentCore, selectedModel });
	const [text, setText] = useState("");
	const [meta, setMeta] = useState<{
		totalLines: number;
		shownLines: number;
		truncated: boolean;
	} | null>(null);
	const [tailLines, setTailLines] = useState(INITIAL_TAIL_LINES);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(
		async (lines: number, activeRef: { current: boolean }) => {
			setLoading(true);
			setError("");
			try {
				const response = await fetch(
					`/api/variant-runs/${runId}/transcript?tail=${lines}`,
					{ cache: "no-store" },
				);
				if (!response.ok) {
					if (activeRef.current) setError("Could not load transcript.");
					return;
				}
				const payload: unknown = await response.json();
				if (
					!activeRef.current ||
					typeof payload !== "object" ||
					payload === null
				) {
					return;
				}
				const record = payload as Record<string, unknown>;
				setText(typeof record.text === "string" ? record.text : "");
				setMeta({
					totalLines:
						typeof record.totalLines === "number" ? record.totalLines : 0,
					shownLines:
						typeof record.shownLines === "number" ? record.shownLines : 0,
					truncated: record.truncated === true,
				});
			} catch {
				if (activeRef.current) setError("Could not load transcript.");
			} finally {
				if (activeRef.current) setLoading(false);
			}
		},
		[runId],
	);

	useEffect(() => {
		const activeRef = { current: true };
		void load(tailLines, activeRef);
		return () => {
			activeRef.current = false;
		};
	}, [load, tailLines]);

	const canLoadMore =
		meta !== null &&
		(meta.truncated || meta.shownLines < meta.totalLines) &&
		tailLines < MAX_TAIL_LINES;

	if (loading && !text) {
		return <p className="muted">Loading transcript…</p>;
	}
	if (error) {
		return <p className="muted">{error}</p>;
	}
	if (!text) {
		return <p className="muted">Agent transcript is still streaming.</p>;
	}

	return (
		<>
			<p className="muted transcript-meta">
				{agentLabel} JSONL —{" "}
				{meta
					? `${meta.shownLines.toLocaleString()} of ${meta.totalLines.toLocaleString()} lines shown`
					: "lines loaded"}
				{meta?.truncated
					? " (older lines omitted for performance; full trace is on disk)"
					: ""}
			</p>
			<p className="muted transcript-meta">
				Invocation: <code>{invocation}</code>
			</p>
			<VirtualizedTranscript text={text} />
			{canLoadMore ? (
				<button
					className="button secondary-button transcript-load-more"
					type="button"
					disabled={loading}
					onClick={() =>
						setTailLines((current) =>
							Math.min(MAX_TAIL_LINES, current + LOAD_MORE_STEP),
						)
					}
				>
					{loading ? "Loading…" : "Load older lines"}
				</button>
			) : null}
		</>
	);
}
