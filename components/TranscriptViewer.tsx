"use client";

import { useEffect, useState } from "react";
import { agentDisplayName } from "@/lib/agent-display";

export function TranscriptViewer({
	runId,
	agentCore,
	invocation,
}: {
	runId: string;
	agentCore: string;
	invocation: string;
}) {
	const [text, setText] = useState("");
	const [meta, setMeta] = useState<{
		totalLines: number;
		shownLines: number;
		truncated: boolean;
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let active = true;
		async function load() {
			setLoading(true);
			setError("");
			try {
				const response = await fetch(
					`/api/variant-runs/${runId}/transcript?tail=800`,
					{ cache: "no-store" },
				);
				if (!response.ok) {
					if (active) setError("Could not load transcript.");
					return;
				}
				const payload: unknown = await response.json();
				if (!active || typeof payload !== "object" || payload === null) return;
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
				if (active) setError("Could not load transcript.");
			} finally {
				if (active) setLoading(false);
			}
		}
		void load();
		return () => {
			active = false;
		};
	}, [runId]);

	if (loading) {
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
				{agentDisplayName(agentCore)} JSONL —{" "}
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
			<pre className="transcript">{text}</pre>
		</>
	);
}
