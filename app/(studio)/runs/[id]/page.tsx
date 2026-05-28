import { notFound, redirect } from "next/navigation";
import { ActivityStream } from "@/components/ActivityStream";
import { BeforeAfter } from "@/components/BeforeAfter";
import { DiffViewer } from "@/components/DiffViewer";
import { RunCodeDiffPanel } from "@/components/RunCodeDiffPanel";
import { RunDetailTabs } from "@/components/RunDetailTabs";
import {
	RunDetailLiveElapsed,
	RunDetailLiveStatus,
} from "@/components/RunDetailLiveStatus";
import { RunFailureBanner } from "@/components/RunFailureBanner";
import { RunReceipt } from "@/components/RunReceipt";
import { RunLiveProvider } from "@/components/RunLiveProvider";
import { RunTranscriptPanel } from "@/components/RunTranscriptPanel";
import { requireUser } from "@/lib/auth";
import {
	LEGACY_TAIL_TRUNCATION_THRESHOLD,
	LEGACY_TRANSCRIPT_TRUNCATED_MARKER,
} from "@/lib/agent/process";
import { parseAgentEvents } from "@/lib/agent/transcript";
import { prisma } from "@/lib/db";
import {
	resolveFullTranscript,
	runTranscriptFileByteLength,
} from "@/lib/agent/transcript-store";
import {
	runAgentDisplayLabel,
	workspacePathForDisplay,
} from "@/lib/agent-display";
import { parseStringArrayJson } from "@/lib/json";
import { renderStorefrontBaselineHtml } from "@/lib/storefront-baseline";

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
		include: { product: true },
	});
	if (!run) notFound();
	if (user.role !== "admin" && run.userId !== user.id) redirect("/forbidden");
	const changedFiles = parseStringArrayJson(run.changedFiles);
	const fullTranscript = await resolveFullTranscript(run.id, run.transcript);
	const fileBytes = await runTranscriptFileByteLength(run.id);
	const pollTranscript =
		run.status === "queued" || run.status === "running"
			? run.transcript
			: fullTranscript;
	const events = parseAgentEvents(pollTranscript);
	const legacyMarkerTruncated = fullTranscript.includes(
		LEGACY_TRANSCRIPT_TRUNCATED_MARKER,
	);
	const legacyTailTruncated =
		!fileBytes &&
		run.transcript.length >= LEGACY_TAIL_TRUNCATION_THRESHOLD &&
		!run.transcript.trimStart().startsWith("{");
	const beforePreviewHtml = await renderStorefrontBaselineHtml();
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
							beforePreviewHtml={beforePreviewHtml}
							previewHtml={run.previewHtml}
							agentCore={run.agentCore}
							selectedModel={run.selectedModel}
							status={run.status}
						/>
					</>
				),
				code: (
					<>
						<h2>Code diff</h2>
						<RunCodeDiffPanel
							runId={run.id}
							initialStatus={run.status}
							initialChangedFiles={changedFiles}
							completedDiff={
								run.status !== "queued" &&
								run.status !== "running" &&
								changedFiles.length ? (
									<DiffViewer
										workspacePath={run.workspacePath}
										changedFiles={changedFiles}
									/>
								) : undefined
							}
						/>
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
						<RunTranscriptPanel
							runId={run.id}
							agentCore={run.agentCore}
							selectedModel={run.selectedModel}
							invocation={run.codexCommand}
							initialEvents={events}
							initialStatus={run.status}
						/>
					</>
				),
			}}
		/>
	);
	return (
		<main className="studio-page" id="main-content">
			<RunLiveProvider
				runId={run.id}
				initialStatus={run.status}
				initialEvents={events}
				initialHasPreview={Boolean(run.previewHtml?.trim())}
			>
				<section className="studio-hero studio-hero--compact">
					<div className="split-heading">
						<div>
							<p className="section-kicker">Run detail · {runLabel}</p>
							<h1>{run.campaignGoal}</h1>
							<p>{run.campaignBrief}</p>
							<p className="muted run-meta">
								{workspacePathForDisplay(run.agentCore, run.workspacePath)} ·{" "}
								<RunDetailLiveElapsed
									startedAt={run.startedAt.toISOString()}
									completedAt={run.completedAt?.toISOString() ?? null}
									initialStatus={run.status}
								/>
							</p>
						</div>
						<RunDetailLiveStatus initialStatus={run.status} />
					</div>
				</section>
				{run.status === "failed" ? (
					<RunFailureBanner error={run.error} runId={run.id} />
				) : null}
				{activity}
				{tabs}
			</RunLiveProvider>
		</main>
	);
}
