import { notFound, redirect } from "next/navigation";
import { ActivityStream } from "@/components/ActivityStream";
import { BeforeAfter } from "@/components/BeforeAfter";
import { DiffViewer } from "@/components/DiffViewer";
import { RunDetailTabs } from "@/components/RunDetailTabs";
import { RunReceipt } from "@/components/RunReceipt";
import { requireUser } from "@/lib/auth";
import { parseCodexEvents } from "@/lib/codex-runner";
import { prisma } from "@/lib/db";

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
	const changedFiles = JSON.parse(run.changedFiles || "[]") as string[];
	const events = parseCodexEvents(run.transcript);
	const activity = (
		<ActivityStream
			runId={run.id}
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
						<BeforeAfter product={run.product} previewHtml={run.previewHtml} />
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
								Code changes will appear when Codex finishes.
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
						<pre className="transcript">
							{run.transcript || "Codex transcript is still streaming."}
						</pre>
					</>
				),
			}}
		/>
	);
	return (
		<main className="studio-page" id="main-content">
			<section className="studio-hero studio-hero--compact">
				<p className="section-kicker">Run detail</p>
				<h1>{run.campaignGoal}</h1>
				<p>{run.campaignBrief}</p>
			</section>
			{activity}
			{tabs}
		</main>
	);
}
