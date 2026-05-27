import type { ReactNode, Ref } from "react";
import { runAgentDisplayLabel } from "@/lib/agent-display";
import {
	agentEventsToActivityRows,
	type ActivityInputEvent,
} from "@/lib/activity-view";

export type ActivityEventItem = ActivityInputEvent;

const ARCHIVE_TEXT_LIMIT = 12000;
const ARCHIVE_MAX_VISIBLE_ROWS = Number.MAX_SAFE_INTEGER;

interface ActivityLogProps {
	titleId: string;
	kicker: string;
	agentName: string;
	agentCore?: string;
	status: string;
	events: ActivityEventItem[];
	textLimit: number;
	maxVisibleRows: number;
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
	maxVisibleRows,
	demoLive,
	emptyMessage,
	afterHeader = null,
	className = "",
	listRef,
}: ActivityLogProps) {
	const rows = agentEventsToActivityRows({
		agentCore,
		agentLabel: agentName,
		events,
		maxBodyChars: textLimit,
		demoLive,
	});
	const visibleRows =
		rows.length > maxVisibleRows ? rows.slice(-maxVisibleRows) : rows;
	const hiddenCount = Math.max(0, rows.length - visibleRows.length);
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
			{visibleRows.length ? (
				<>
					{hiddenCount > 0 ? (
						<p className="muted activity-list-meta">
							Showing last {visibleRows.length} of {rows.length} activity steps.
							{agentCore === "pi" ? (
								<> Full raw JSONL is on the Transcript tab.</>
							) : null}
						</p>
					) : null}
					<ol className="activity-list" ref={listRef}>
						{visibleRows.map((row) => (
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
			maxVisibleRows={ARCHIVE_MAX_VISIBLE_ROWS}
			demoLive={false}
			className="activity-card--archive"
			emptyMessage="No activity events were captured for this run."
		/>
	);
}
