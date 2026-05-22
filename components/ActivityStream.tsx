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

function piMessageUpdateKind(event: EventItem): "text" | "thinking" | "other" {
	const assistantEvent = event.parsed.assistantMessageEvent;
	if (!isJsonObject(assistantEvent)) return "other";
	if (assistantEvent.type === "text_delta") return "text";
	if (assistantEvent.type === "thinking_delta") return "thinking";
	return "other";
}

function labelForPi(event: EventItem) {
	if (event.type === "merged_assistant_text") return "Assistant";
	if (event.type === "merged_thinking_text") return "Thinking";
	if (event.type === "session") return "Pi session";
	if (event.type === "agent_start") return "Pi agent started";
	if (event.type === "agent_end") return "Pi agent finished";
	if (event.type === "turn_start") return "Pi turn";
	if (event.type === "turn_end") return "Pi turn finished";
	if (event.type === "tool_execution_start") return "Tool started";
	if (event.type === "tool_execution_update") return "Tool progress";
	if (event.type === "tool_execution_end") return "Tool finished";
	if (event.type === "message_start") return "Message started";
	if (event.type === "message_update") {
		const kind = piMessageUpdateKind(event);
		if (kind === "thinking") return "Thinking";
		if (kind === "text") return "Message update (text)";
		return "Message update";
	}
	if (event.type === "message_end") return "Message finished";
	return event.type;
}

function labelFor(agentCore: string, event: EventItem) {
	return agentCore === "pi" ? labelForPi(event) : labelForCodex(event);
}

function piDeltaFromEvent(event: EventItem): string {
	const assistantEvent = event.parsed.assistantMessageEvent;
	if (!isJsonObject(assistantEvent) || typeof assistantEvent.delta !== "string") {
		return "";
	}
	return assistantEvent.delta;
}

/** Merge consecutive Pi text_delta / thinking_delta message_update lines. */
function mergePiMessageUpdateDeltas(events: EventItem[]): EventItem[] {
	const out: EventItem[] = [];
	let textBuffer = "";
	let thinkingBuffer = "";
	const flushText = () => {
		if (!textBuffer) return;
		out.push({
			id: `merged-assistant-${out.length}`,
			type: "merged_assistant_text",
			raw: textBuffer,
			parsed: { type: "merged_assistant_text", text: textBuffer },
		});
		textBuffer = "";
	};
	const flushThinking = () => {
		if (!thinkingBuffer) return;
		out.push({
			id: `merged-thinking-${out.length}`,
			type: "merged_thinking_text",
			raw: thinkingBuffer,
			parsed: { type: "merged_thinking_text", text: thinkingBuffer },
		});
		thinkingBuffer = "";
	};
	const flushAll = () => {
		flushText();
		flushThinking();
	};
	for (const event of events) {
		if (event.type === "message_update") {
			const kind = piMessageUpdateKind(event);
			if (kind === "text") {
				flushThinking();
				textBuffer += piDeltaFromEvent(event);
				continue;
			}
			if (kind === "thinking") {
				flushText();
				thinkingBuffer += piDeltaFromEvent(event);
				continue;
			}
		}
		flushAll();
		out.push(event);
	}
	flushAll();
	return out;
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

function eventText(
	agentCore: string,
	event: EventItem,
	maxChars: number,
) {
	if (
		event.type === "merged_assistant_text" ||
		event.type === "merged_thinking_text"
	) {
		const text =
			typeof event.parsed.text === "string" ? event.parsed.text : "";
		return text.trim().slice(0, maxChars);
	}
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
		if (event.raw.trim()) return event.raw.trim().slice(0, maxChars);
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
				? `\n${item.aggregated_output.trim().slice(0, maxChars)}`
				: "";
		return `${command}${output}`;
	}
	if (item?.type === "file_change")
		return formatChanges(item.changes) || "Source files changed.";
	if (typeof item?.text === "string") return item.text;
	if (typeof item?.name === "string") return item.name;
	if (typeof event.parsed.message === "string") return event.parsed.message;
	return event.raw.trim().slice(0, maxChars) || labelFor(agentCore, event);
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

	const displayEvents = useMemo(() => {
		if (agentCore === "pi") {
			return mergePiMessageUpdateDeltas(events);
		}
		return events;
	}, [agentCore, events]);

	const maxVisibleEvents = status === "running" ? 200 : 400;
	const visibleEvents = useMemo(
		() =>
			displayEvents.length > maxVisibleEvents
				? displayEvents.slice(-maxVisibleEvents)
				: displayEvents,
		[displayEvents, maxVisibleEvents],
	);
	const textLimit = status === "running" ? 4000 : 12000;
	const hiddenEventCount = Math.max(0, displayEvents.length - visibleEvents.length);

	useEffect(() => {
		const activityList = activityListRef.current;
		if (!activityList) return;
		activityList.scrollTop = activityList.scrollHeight;
	}, [visibleEvents.length, status]);

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
				<>
					{hiddenEventCount > 0 ? (
						<p className="muted activity-list-meta">
							Showing last {visibleEvents.length} of {displayEvents.length}{" "}
							events ({events.length} raw lines in transcript).
						</p>
					) : null}
					<ol className="activity-list" ref={activityListRef}>
						{visibleEvents.map((event) => (
							<li
								key={event.id}
								className={
									event.type === "merged_assistant_text" ||
									event.type === "merged_thinking_text"
										? "activity-item--prose"
										: undefined
								}
							>
								<strong>{labelFor(agentCore, event)}</strong>
								<code>{eventText(agentCore, event, textLimit)}</code>
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