"use client";

import { useState } from "react";
import { TranscriptViewer } from "@/components/TranscriptViewer";

export function ProofTranscriptSection({
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
	const [open, setOpen] = useState(false);

	return (
		<details
			className="proof-details"
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary>Full transcript</summary>
			{open ? (
				<TranscriptViewer
					runId={runId}
					agentCore={agentCore}
					selectedModel={selectedModel}
					invocation={invocation}
				/>
			) : null}
		</details>
	);
}
