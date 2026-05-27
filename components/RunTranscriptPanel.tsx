"use client";

import { ActivityArchive } from "@/components/ActivityLog";
import { TranscriptViewer } from "@/components/TranscriptViewer";

interface EventItem {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

export function RunTranscriptPanel({
	runId,
	agentCore,
	selectedModel = "",
	invocation,
	initialEvents,
	initialStatus,
}: {
	runId: string;
	agentCore: string;
	selectedModel?: string;
	invocation: string;
	initialEvents: EventItem[];
	initialStatus: string;
}) {
	const isRunning = initialStatus === "running";

	return (
		<>
			<p className="muted">
				{isRunning
					? "Live activity is streaming in the panel above. This tab keeps a readable log and export options."
					: "Human-readable activity from this run."}
			</p>
			{isRunning ? null : (
				<ActivityArchive
					agentCore={agentCore}
					selectedModel={selectedModel}
					initialEvents={initialEvents}
					initialStatus={initialStatus}
				/>
			)}
			<div className="transcript-export">
				<a
					className="button secondary-button"
					href={`/api/variant-runs/${runId}/transcript?download=1`}
				>
					Download full transcript
				</a>
			</div>
			<details className="transcript-advanced">
				<summary>Advanced / Export</summary>
				<p className="muted">
					Raw JSONL from the agent harness (one JSON object per line).
				</p>
				<TranscriptViewer
					runId={runId}
					agentCore={agentCore}
					selectedModel={selectedModel}
					invocation={invocation}
				/>
			</details>
		</>
	);
}
