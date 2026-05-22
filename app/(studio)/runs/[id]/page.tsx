import { notFound, redirect } from "next/navigation";
import { ActivityStream } from "@/components/ActivityStream";
import { BeforeAfter } from "@/components/BeforeAfter";
import { DiffViewer } from "@/components/DiffViewer";
import { RunDetailTabs } from "@/components/RunDetailTabs";
import { RunElapsed } from "@/components/RunElapsed";
import { RunFailureBanner } from "@/components/RunFailureBanner";
import { RunReceipt } from "@/components/RunReceipt";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { requireUser } from "@/lib/auth";
import { parseCodexEvents } from "@/lib/codex-runner";
import { prisma } from "@/lib/db";
import { LEGACY_TRANSCRIPT_TRUNCATED_MARKER } from "@/lib/agent/process";
import {
	resolveFullTranscript,
	runTranscriptFileByteLength,
} from "@/lib/agent/transcript-store";
import {
	runAgentDisplayLabel,
	workspacePathForDisplay,
} from "@/lib/agent-display";
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
	const runLabel = runAgentDisplayLabel({
		agentCore: run.agentCore,
		selectedModel: run.selectedModel,
	});
	const activity = (
		<ActivityStream
			runId={run.id}
			agentCore={run.agentCore}
			selectedModel={run.selectedModel}
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
							selectedModel={run.selectedModel}
							status={run.status}
							runId={run.id}
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
							Raw JSONL from {runLabel} (one JSON object
							per line). The live activity panel above is the readable,
							TUI-style view of the same run.
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
						<TranscriptViewer
							runId={run.id}
							agentCore={run.agentCore}
							selectedModel={run.selectedModel}
							invocation={run.codexCommand}
						/>
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
							Run detail · {runLabel}
						</p>
						<h1>{run.campaignGoal}</h1>
						<p>{run.campaignBrief}</p>
						<p className="muted run-meta">
							{workspacePathForDisplay(run.agentCore, run.workspacePath)} ·{" "}
							<RunElapsed
								startedAt={run.startedAt.toISOString()}
								completedAt={run.completedAt?.toISOString() ?? null}
								status={run.status}
								showElapsedSuffix={run.status === "running"}
							/>
						</p>
					</div>
					<span className={`status-pill status-pill--${run.status}`}>
						{run.status}
					</span>
				</div>
			</section>
			{run.status === "failed" ? (
				<RunFailureBanner error={run.error} runId={run.id} />
			) : null}
			{activity}
			{tabs}
		</main>
	);
}
