"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { VariantRunPollSchema } from "@/lib/variant-run-api";

interface EventItem {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function labelForPi(event: EventItem) {
	if (event.type === "session") return "Pi session";
	if (event.type === "agent_start") return "Pi agent started";
	if (event.type === "agent_end") return "Pi agent finished";
	if (event.type === "turn_start") return "Pi turn";
	if (event.type === "turn_end") return "Pi turn finished";
	if (event.type === "tool_execution_start") return "Tool started";
	if (event.type === "tool_execution_update") return "Tool progress";
	if (event.type === "tool_execution_end") return "Tool finished";
	if (event.type === "message_start") return "Message started";
	if (event.type === "message_update") return "Message update";
	if (event.type === "message_end") return "Message finished";
	return event.type;
}

function labelFor(agentCore: string, event: EventItem) {
	return agentCore === "pi" ? labelForPi(event) : labelForCodex(event);
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

function eventText(agentCore: string, event: EventItem) {
	const item = itemFor(event);
	if (agentCore === "pi") {
		if (
			event.type === "tool_execution_start" ||
			event.type === "tool_execution_end"
		) {
			const toolName =
				typeof event.parsed.toolName === "string"
					? event.parsed.toolName
					: "tool";
			return toolName;
		}
		if (event.type === "message_update") {
			const assistantEvent = event.parsed.assistantMessageEvent;
			const delta = isJsonObject(assistantEvent)
				? assistantEvent.delta
				: undefined;
			if (typeof delta === "string" && delta.trim())
				return delta.trim().slice(0, 700);
		}
	}
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
	const activityListRef = useRef<HTMLOListElement>(null);
	const agentName = agentCore === "pi" ? "Pi" : "Codex";

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
					<h2 id="activity-title">{agentName} activity</h2>
				</div>
				<span className={`status-pill status-pill--${status}`}>{status}</span>
			</div>
			{visibleEvents.length ? (
				<ol className="activity-list" ref={activityListRef}>
					{visibleEvents.map((event) => (
						<li key={event.id}>
							<strong>{labelFor(agentCore, event)}</strong>
							<code>{eventText(agentCore, event)}</code>
						</li>
					))}
				</ol>
			) : (
				<p className="muted">
					Waiting for {agentName} to emit its first file read, edit, or command
					event.
				</p>
			)}
		</section>
	);
}
