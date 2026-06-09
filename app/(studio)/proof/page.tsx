import type { Metadata } from "next";
import Link from "next/link";
import { RunReceipt } from "@/components/RunReceipt";
import { ProofTranscriptSection } from "@/components/ProofTranscriptSection";
import {
	runAgentDisplayLabel,
	workspacePathForDisplay,
} from "@/lib/agent-display";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Proof",
};

export default async function ProofPage({
	searchParams,
}: {
	searchParams: Promise<{ runId?: string }>;
}) {
	await requireAdmin();
	const { runId } = await searchParams;
	const recentRuns = await prisma.variantRun.findMany({
		include: { product: true },
		orderBy: { startedAt: "desc" },
		take: 50,
	});
	const requestedRun = runId
		? (recentRuns.find((run) => run.id === runId) ??
			(await prisma.variantRun.findUnique({
				where: { id: runId },
				include: { product: true },
			})))
		: null;
	const latestRun =
		requestedRun ??
		recentRuns.find((run) => run.status === "succeeded") ??
		recentRuns[0] ??
		null;
	return (
		<main className="studio-page proof-page" id="main-content">
			<section className="studio-hero studio-hero--compact">
				<p className="section-kicker">Admin proof</p>
				<h1>Complete agent execution receipt</h1>
				<p>
					This page is admin-only and shows the full command, prompt, manifest,
					validation, transcript, and workspace evidence for the selected run.
					It defaults to the latest succeeded run when available.
				</p>
			</section>
			{latestRun ? (
				<section
					className="studio-card proof-grid"
					aria-label="Agent execution proof"
				>
					<form className="proof-run-selector" action="/proof" method="get">
						<label className="field">
							Run
							<select name="runId" defaultValue={latestRun.id}>
								{recentRuns.map((run) => (
									<option key={run.id} value={run.id}>
										{run.status.toUpperCase()} · {run.campaignGoal} ·{" "}
										{run.id.slice(0, 8)}
									</option>
								))}
								{!recentRuns.some((run) => run.id === latestRun.id) ? (
									<option value={latestRun.id}>
										{latestRun.status.toUpperCase()} · {latestRun.campaignGoal}{" "}
										· {latestRun.id.slice(0, 8)}
									</option>
								) : null}
							</select>
						</label>
						<button className="button secondary-button" type="submit">
							View proof
						</button>
					</form>
					<div className="proof-alert proof-alert--live">
						<strong>
							{latestRun.id === "seeded-demo-variant"
								? "Seeded demo data"
								: `Persisted ${runAgentDisplayLabel({
										agentCore: latestRun.agentCore,
										selectedModel: latestRun.selectedModel,
									})} run`}
						</strong>
						<span>
							Run {latestRun.id} for {latestRun.product.name}
						</span>
					</div>
					<RunReceipt run={latestRun} detailsOpen={false} />
					<ProofTranscriptSection
						runId={latestRun.id}
						agentCore={latestRun.agentCore}
						selectedModel={latestRun.selectedModel}
						invocation={latestRun.codexCommand}
					/>
					<details className="proof-details">
						<summary>Workspace path and changed files</summary>
						<pre>{`${workspacePathForDisplay(latestRun.agentCore, latestRun.workspacePath)}\n${latestRun.changedFiles}`}</pre>
					</details>
					<Link
						className="button secondary-button"
						href={`/runs/${latestRun.id}`}
					>
						Open run detail
					</Link>
				</section>
			) : (
				<p className="muted">
					No proof is available. Run npm run setup to seed demo data.
				</p>
			)}
		</main>
	);
}
