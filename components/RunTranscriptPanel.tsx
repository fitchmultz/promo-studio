"use client";

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
	initialStatus,
}: {
	runId: string;
	agentCore: string;
	selectedModel?: string;
	invocation: string;
	initialEvents: EventItem[];
	initialStatus: string;
}) {
	const isRunning = initialStatus === "queued" || initialStatus === "running";

	return (
		<>
			<p className="muted">
				{isRunning
					? "Live activity is streaming in the panel above. The raw JSONL transcript below updates from the stored run log."
					: "Raw JSONL from the agent harness, one JSON object per line."}
			</p>
			<div className="transcript-export">
				<a
					className="button secondary-button"
					href={`/api/variant-runs/${runId}/transcript?download=1`}
				>
					Download full transcript
				</a>
			</div>
			<TranscriptViewer
				runId={runId}
				agentCore={agentCore}
				selectedModel={selectedModel}
				invocation={invocation}
			/>
		</>
	);
}
