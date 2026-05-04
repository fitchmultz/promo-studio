"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface EventItem {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

function itemFor(event: EventItem) {
	return event.parsed.item as Record<string, unknown> | undefined;
}

function labelFor(event: EventItem) {
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
			const entry = change as { path?: unknown; kind?: unknown };
			const path =
				typeof entry.path === "string"
					? (entry.path.split("/storefront/").pop() ?? entry.path)
					: "file";
			return `${entry.kind ?? "change"}: ${path}`;
		})
		.join("\n");
}

function eventText(event: EventItem) {
	const item = itemFor(event);
	if (
		event.type === "thread.started" &&
		typeof event.parsed.thread_id === "string"
	)
		return `Started ${event.parsed.thread_id}`;
	if (event.type === "turn.started")
		return "Codex began the requested storefront work.";
	if (item?.type === "command_execution") {
		const command =
			typeof item.command === "string"
				? item.command.replace(/^\/bin\/zsh -lc /, "")
				: "shell command";
		const output =
			typeof item.aggregated_output === "string" &&
			item.aggregated_output.trim()
				? `\n${item.aggregated_output.trim().slice(0, 700)}`
				: "";
		return `${command}${output}`;
	}
	if (item?.type === "file_change")
		return formatChanges(item.changes) || "Source files changed.";
	if (typeof item?.text === "string") return item.text;
	if (typeof item?.name === "string") return item.name;
	if (typeof event.parsed.message === "string") return event.parsed.message;
	return event.raw;
}

export function ActivityStream({
	runId,
	initialEvents = [],
	initialStatus = "running",
}: {
	runId: string;
	initialEvents?: EventItem[];
	initialStatus?: string;
}) {
	const router = useRouter();
	const [events, setEvents] = useState(initialEvents);
	const [status, setStatus] = useState(initialStatus);
	const activityListRef = useRef<HTMLOListElement>(null);

	useEffect(() => {
		if (status !== "running") return undefined;
		let active = true;
		async function poll() {
			const response = await fetch(`/api/variant-runs/${runId}`, {
				cache: "no-store",
			});
			if (!active || !response.ok) return;
			const payload = (await response.json()) as {
				events: EventItem[];
				run: { status: string };
			};
			const nextStatus = payload.run.status;
			setEvents(payload.events);
			setStatus(nextStatus);
			if (nextStatus !== "running") router.refresh();
		}
		void poll();
		const timer = setInterval(() => void poll(), 1500);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [router, runId, status]);

	const visibleEvents = useMemo(() => events.slice(-80), [events]);

	useEffect(() => {
		const activityList = activityListRef.current;
		if (!activityList) return;
		activityList.scrollTop = activityList.scrollHeight;
	});

	return (
		<section
			className={`studio-card activity-card activity-card--${status}`}
			aria-labelledby="activity-title"
		>
			<div className="split-heading">
				<div>
					<p className="section-kicker">Live agent stream</p>
					<h2 id="activity-title">Codex activity</h2>
				</div>
				<span className={`status-pill status-pill--${status}`}>{status}</span>
			</div>
			{visibleEvents.length ? (
				<ol className="activity-list" ref={activityListRef}>
					{visibleEvents.map((event) => (
						<li key={event.id}>
							<strong>{labelFor(event)}</strong>
							<code>{eventText(event)}</code>
						</li>
					))}
				</ol>
			) : (
				<p className="muted">
					Waiting for Codex to emit its first file read, edit, or command event.
				</p>
			)}
		</section>
	);
}
