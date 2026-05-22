import { notFound, redirect } from "next/navigation";
import { ActivityStream } from "@/components/ActivityStream";
import { BeforeAfter } from "@/components/BeforeAfter";
import { DiffViewer } from "@/components/DiffViewer";
import { RunDetailTabs } from "@/components/RunDetailTabs";
import { RunReceipt } from "@/components/RunReceipt";
import { requireUser } from "@/lib/auth";
import { parseCodexEvents } from "@/lib/codex-runner";
import { prisma } from "@/lib/db";
import { LEGACY_TRANSCRIPT_TRUNCATED_MARKER } from "@/lib/agent/process";
import {
	resolveFullTranscript,
	runTranscriptFileByteLength,
} from "@/lib/agent/transcript-store";
import { agentDisplayName } from "@/lib/agent-display";
import { parseStringArrayJson } from "@/lib/json";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const user = await requireUser();
	const { id } = await params;
	const run = await prisma.variantRun.findUnique({
		where: { id },
		include: { product: true, user: true },
	});
	if (!run) notFound();
	if (user.role !== "admin" && run.userId !== user.id) redirect("/forbidden");
	const changedFiles = parseStringArrayJson(run.changedFiles);
	const fullTranscript = await resolveFullTranscript(run.id, run.transcript);
	const fileBytes = await runTranscriptFileByteLength(run.id);
	const pollTranscript =
		run.status === "running" ? run.transcript : fullTranscript;
	const events = parseCodexEvents(pollTranscript);
	const legacyMarkerTruncated = fullTranscript.includes(
		LEGACY_TRANSCRIPT_TRUNCATED_MARKER,
	);
	const legacyTailTruncated =
		!fileBytes &&
		run.transcript.length >= 119_000 &&
		!run.transcript.trimStart().startsWith("{");
	const activity = (
		<ActivityStream
			runId={run.id}
			agentCore={run.agentCore}
			initialEvents={events}
			initialStatus={run.status}
		/>
	);
	const tabs = (
		<RunDetailTabs
			panels={{
				preview: (
					<>
						<h2>Before and after preview</h2>
						<BeforeAfter
							product={run.product}
							previewHtml={run.previewHtml}
							agentCore={run.agentCore}
							status={run.status}
						/>
					</>
				),
				code: (
					<>
						<h2>Code diff</h2>
						{changedFiles.length ? (
							<DiffViewer
								workspacePath={run.workspacePath}
								changedFiles={changedFiles}
							/>
						) : (
							<p className="muted">
								Code changes will appear when the agent finishes.
							</p>
						)}
					</>
				),
				validation: (
					<>
						<h2>Execution receipt</h2>
						<RunReceipt run={run} />
					</>
				),
				transcript: (
					<>
						<h2>Transcript</h2>
						<p className="muted">
							Raw JSONL from the agent (one JSON object per line). The live
							activity panel above is a readable, TUI-style view of the same run.
						</p>
						{legacyMarkerTruncated ? (
							<p className="muted">
								This run used an older transcript cap that injected a truncation
								marker into the stream. Start a new variant run for the full
								trace without that message.
							</p>
						) : legacyTailTruncated ? (
							<p className="muted">
								This run was stored with an older 120KB tail cap, so the start
								of the Pi JSONL stream is missing. Create a new variant run to
								capture the full trace.
							</p>
						) : null}
						<p className="muted transcript-meta">
							{fullTranscript
								? `${fullTranscript.length.toLocaleString()} characters · ${events.length.toLocaleString()} JSONL lines${fileBytes ? " · full trace on disk" : ""}`
								: "Agent transcript is still streaming."}
						</p>
						<pre className="transcript">
							{fullTranscript || "Agent transcript is still streaming."}
						</pre>
					</>
				),
			}}
		/>
	);
	return (
		<main className="studio-page" id="main-content">
			<section className="studio-hero studio-hero--compact">
				<div className="split-heading">
					<div>
						<p className="section-kicker">
							Run detail · {agentDisplayName(run.agentCore)}
						</p>
						<h1>{run.campaignGoal}</h1>
						<p>{run.campaignBrief}</p>
					</div>
					<span className={`status-pill status-pill--${run.status}`}>
						{run.status}
					</span>
				</div>
			</section>
			{activity}
			{tabs}
		</main>
	);
}
