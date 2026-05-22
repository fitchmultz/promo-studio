import Link from "next/link";
import { RunReceipt } from "@/components/RunReceipt";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProofPage() {
	await requireAdmin();
	const latestRun = await prisma.variantRun.findFirst({
		include: { product: true, user: true },
		orderBy: { startedAt: "desc" },
	});
	return (
		<main className="studio-page proof-page" id="main-content">
			<section className="studio-hero studio-hero--compact">
				<p className="section-kicker">Admin proof</p>
				<h1>Complete Codex execution receipt</h1>
				<p>
					This page is admin-only and shows the full command, prompt, manifest,
					validation, transcript, and workspace evidence.
				</p>
			</section>
			{latestRun ? (
				<section
					className="studio-card proof-grid"
					aria-label="Codex execution proof"
				>
					<div className="proof-alert proof-alert--live">
						<strong>
							{latestRun.id === "seeded-demo-variant"
								? "Seeded demo data"
								: "Persisted Codex run"}
						</strong>
						<span>
							Run {latestRun.id} for {latestRun.product.name}
						</span>
					</div>
					<RunReceipt run={latestRun} />
					<details className="proof-details" open>
						<summary>Full transcript</summary>
						<pre>
							{latestRun.transcript ||
								latestRun.stdout ||
								"No transcript captured."}
						</pre>
					</details>
					<details className="proof-details">
						<summary>Workspace path and changed files</summary>
						<pre>{`${latestRun.workspacePath}\n${latestRun.changedFiles}`}</pre>
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
