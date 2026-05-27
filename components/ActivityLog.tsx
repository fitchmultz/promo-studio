import type { ReactNode, Ref } from "react";
import {
	formatShellCommandForDisplay,
	runAgentDisplayLabel,
} from "@/lib/agent-display";
import { isJsonObject } from "@/lib/json";
import { piEventsToActivityRows } from "@/lib/pi-activity-view";

export interface ActivityEventItem {
	id: string;
	type: string;
	raw: string;
	parsed: Record<string, unknown>;
}

const CODEX_OUTPUT_PREVIEW_CHARS = 600;
const ARCHIVE_TEXT_LIMIT = 12000;
const ARCHIVE_MAX_VISIBLE_ROWS = Number.MAX_SAFE_INTEGER;

function itemFor(
	event: ActivityEventItem,
): Record<string, unknown> | undefined {
	const item = event.parsed.item;
	return isJsonObject(item) ? item : undefined;
}

interface FileChangeEntry {
	path?: unknown;
	kind?: unknown;
}

function labelForCodex(event: ActivityEventItem) {
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

function codexEventText(event: ActivityEventItem, maxChars: number) {
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
				? formatShellCommandForDisplay(
						item.command.replace(/^\/bin\/zsh -lc /, ""),
					)
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

interface ActivityLogProps {
	titleId: string;
	kicker: string;
	agentName: string;
	agentCore?: string;
	status: string;
	events: ActivityEventItem[];
	textLimit: number;
	maxVisibleEvents: number;
	maxVisiblePiRows: number;
	demoLive: boolean;
	emptyMessage: ReactNode;
	afterHeader?: ReactNode;
	className?: string;
	listRef?: Ref<HTMLOListElement>;
}

export function ActivityLog({
	titleId,
	kicker,
	agentName,
	agentCore = "codex",
	status,
	events,
	textLimit,
	maxVisibleEvents,
	maxVisiblePiRows,
	demoLive,
	emptyMessage,
	afterHeader = null,
	className = "",
	listRef,
}: ActivityLogProps) {
	const isPi = agentCore === "pi";
	const piRows = isPi
		? piEventsToActivityRows(events, textLimit, {
				demoLive,
				agentLabel: agentName,
			})
		: [];
	const visiblePiRows =
		piRows.length > maxVisiblePiRows ? piRows.slice(-maxVisiblePiRows) : piRows;
	const visibleCodexEvents =
		events.length > maxVisibleEvents ? events.slice(-maxVisibleEvents) : events;
	const hiddenCount = isPi
		? Math.max(0, piRows.length - visiblePiRows.length)
		: Math.max(0, events.length - visibleCodexEvents.length);
	const hasContent = isPi
		? visiblePiRows.length > 0
		: visibleCodexEvents.length > 0;
	const cardClassName = [
		"studio-card",
		"activity-card",
		`activity-card--${status}`,
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<section className={cardClassName} aria-labelledby={titleId}>
			<div className="split-heading">
				<div>
					<p className="section-kicker">{kicker}</p>
					<h2 id={titleId}>{agentName} activity</h2>
				</div>
				<span className={`status-pill status-pill--${status}`}>{status}</span>
			</div>
			{afterHeader}
			{hasContent ? (
				<>
					{hiddenCount > 0 ? (
						<p className="muted activity-list-meta">
							Showing last{" "}
							{isPi ? visiblePiRows.length : visibleCodexEvents.length} of{" "}
							{isPi ? piRows.length : events.length}{" "}
							{isPi ? "activity steps" : "events"}.
							{isPi ? <> Full raw JSONL is on the Transcript tab.</> : null}
						</p>
					) : null}
					<ol className="activity-list" ref={listRef}>
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
				<p className="muted">{emptyMessage}</p>
			)}
		</section>
	);
}

export function ActivityArchive({
	agentCore,
	selectedModel = "",
	initialEvents,
	initialStatus,
}: {
	agentCore: string;
	selectedModel?: string;
	initialEvents: ActivityEventItem[];
	initialStatus: string;
}) {
	const agentName = runAgentDisplayLabel({ agentCore, selectedModel });

	return (
		<ActivityLog
			titleId="activity-archive-title"
			kicker="Activity log"
			agentName={agentName}
			agentCore={agentCore}
			status={initialStatus}
			events={initialEvents}
			textLimit={ARCHIVE_TEXT_LIMIT}
			maxVisibleEvents={initialEvents.length}
			maxVisiblePiRows={ARCHIVE_MAX_VISIBLE_ROWS}
			demoLive={false}
			className="activity-card--archive"
			emptyMessage="No activity events were captured for this run."
		/>
	);
}
