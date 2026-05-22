"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RunPhaseStepper } from "@/components/RunPhaseStepper";
import { agentDisplayName } from "@/lib/agent-display";
import { isJsonObject } from "@/lib/json";
import { piEventsToActivityRows } from "@/lib/pi-activity-view";
import { inferRunPhase } from "@/lib/run-phase";
import { VariantRunPollSchema } from "@/lib/variant-run-api";

interface EventItem {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

const CODEX_OUTPUT_PREVIEW_CHARS = 600;

function itemFor(event: EventItem): Record<string, unknown> | undefined {
	const item = event.parsed.item;
	return isJsonObject(item) ? item : undefined;
}

interface FileChangeEntry {
	path?: unknown;
	kind?: unknown;
}

function labelForCodex(event: EventItem) {
	const item = itemFor(event);
	if (event.type === "thread.started") return "Codex thread";
	if (event.type === "turn.started") return "Codex turn";
	if (event.type === "tool_call") return "Tool call";
	if (event.type === "tool_output") return "Tool output";
	if (event.type === "agent_message") return "Agent message";
	if (item?.type === "agent_message") return "Agent message";
	if (item?.type === "command_execution")
		return item.status === "completed"
			? "Shell command completed"
			: "Shell command started";
	if (item?.type === "file_change")
		return item.status === "completed"
			? "File edit completed"
			: "File edit started";
	if (event.type === "item.started") return "Action started";
	if (event.type === "item.completed") return "Action completed";
	return event.type;
}

function formatChanges(changes: unknown) {
	if (!Array.isArray(changes)) return "";
	return changes
		.map((change) => {
			const entry: FileChangeEntry = isJsonObject(change) ? change : {};
			const path =
				typeof entry.path === "string"
					? (entry.path.split("/storefront/").pop() ?? entry.path)
					: "file";
			return `${entry.kind ?? "change"}: ${path}`;
		})
		.join("\n");
}

function codexEventText(event: EventItem, maxChars: number) {
	const item = itemFor(event);
	if (
		event.type === "thread.started" &&
		typeof event.parsed.thread_id === "string"
	)
		return `Started ${event.parsed.thread_id}`;
	if (event.type === "turn.started")
		return "Agent began the requested storefront work.";
	if (item?.type === "command_execution") {
		const command =
			typeof item.command === "string"
				? item.command.replace(/^\/bin\/zsh -lc /, "")
				: "shell command";
		const rawOutput =
			typeof item.aggregated_output === "string"
				? item.aggregated_output.trim()
				: "";
		if (!rawOutput) return command;
		if (rawOutput.length > CODEX_OUTPUT_PREVIEW_CHARS) {
			return `${command}\n(${rawOutput.length.toLocaleString()} chars of output — see Transcript tab)`;
		}
		return `${command}\n${rawOutput.slice(0, maxChars)}`;
	}
	if (item?.type === "file_change")
		return formatChanges(item.changes) || "Source files changed.";
	if (typeof item?.text === "string") return item.text;
	if (typeof item?.name === "string") return item.name;
	if (typeof event.parsed.message === "string") return event.parsed.message;
	return event.raw.trim().slice(0, maxChars) || labelForCodex(event);
}

export function ActivityStream({
	runId,
	agentCore = "codex",
	initialEvents = [],
	initialStatus = "running",
}: {
	runId: string;
	agentCore?: string;
	initialEvents?: EventItem[];
	initialStatus?: string;
}) {
	const router = useRouter();
	const [events, setEvents] = useState(initialEvents);
	const [status, setStatus] = useState(initialStatus);
	const [hasPreview, setHasPreview] = useState(false);
	const activityListRef = useRef<HTMLOListElement>(null);
	const isPi = agentCore === "pi";
	const agentName = agentDisplayName(agentCore);

	useEffect(() => {
		if (status !== "running") return undefined;
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
			if (nextStatus !== "running") router.refresh();
		}
		void poll();
		const timer = setInterval(() => void poll(), 1500);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [router, runId, status]);

	const textLimit = status === "running" ? 4000 : 12000;

	const piRows = useMemo(() => {
		if (!isPi) return [];
		return piEventsToActivityRows(events, textLimit, { demoLive: true });
	}, [events, isPi, textLimit]);

	const maxVisibleEvents = status === "running" ? 200 : 400;
	const maxVisiblePiRows = status === "running" ? 120 : 200;

	const visiblePiRows = useMemo(() => {
		if (!isPi) return [];
		return piRows.length > maxVisiblePiRows
			? piRows.slice(-maxVisiblePiRows)
			: piRows;
	}, [isPi, maxVisiblePiRows, piRows]);

	const visibleCodexEvents = useMemo(() => {
		if (isPi) return [];
		return events.length > maxVisibleEvents
			? events.slice(-maxVisibleEvents)
			: events;
	}, [events, isPi, maxVisibleEvents]);

	const hiddenCount = isPi
		? Math.max(0, piRows.length - visiblePiRows.length)
		: Math.max(0, events.length - visibleCodexEvents.length);

	const hasContent = isPi ? visiblePiRows.length > 0 : visibleCodexEvents.length > 0;

	const runPhase = useMemo(
		() =>
			inferRunPhase({
				status,
				agentCore,
				hasPreview,
				events,
			}),
		[status, agentCore, hasPreview, events],
	);

	useEffect(() => {
		const activityList = activityListRef.current;
		if (!activityList) return;
		activityList.scrollTop = activityList.scrollHeight;
	}, [hasContent, status, visibleCodexEvents.length, visiblePiRows.length]);

	return (
		<section
			className={`studio-card activity-card activity-card--${status}`}
			aria-labelledby="activity-title"
		>
			<div className="split-heading">
				<div>
					<p className="section-kicker">Live agent stream</p>
					<h2 id="activity-title">{agentName} activity</h2>
				</div>
				<span className={`status-pill status-pill--${status}`}>{status}</span>
			</div>
			{status === "running" ? <RunPhaseStepper phase={runPhase} /> : null}
			{hasContent ? (
				<>
					{hiddenCount > 0 ? (
						<p className="muted activity-list-meta">
							Showing last{" "}
							{isPi ? visiblePiRows.length : visibleCodexEvents.length} of{" "}
							{isPi ? piRows.length : events.length}{" "}
							{isPi ? "activity steps" : "events"}.
							{isPi ? (
								<>
									{" "}
									Full raw JSONL is on the Transcript tab.
								</>
							) : null}
						</p>
					) : null}
					<ol className="activity-list" ref={activityListRef}>
						{isPi
							? visiblePiRows.map((row) => (
									<li
										key={row.id}
										className={
											row.variant === "prose"
												? "activity-item--prose"
												: row.variant === "tool"
													? "activity-item--tool"
													: "activity-item--muted"
										}
									>
										<strong>{row.label}</strong>
										<code>{row.body.trim().slice(0, textLimit)}</code>
									</li>
								))
							: visibleCodexEvents.map((event) => (
									<li key={event.id}>
										<strong>{labelForCodex(event)}</strong>
										<code>{codexEventText(event, textLimit)}</code>
									</li>
								))}
					</ol>
				</>
			) : (
				<p className="muted">
					Waiting for {agentName} to emit its first file read, edit, or command
					event.
				</p>
			)}
		</section>
	);
}
