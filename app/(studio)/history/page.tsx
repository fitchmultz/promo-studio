import { RunHistory } from "@/components/RunHistory";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
	const user = await requireUser();
	const runs = await prisma.variantRun.findMany({
		where: user.role === "admin" ? undefined : { userId: user.id },
		include: { product: true },
		orderBy: { startedAt: "desc" },
		take: 50,
	});
	return (
		<main className="studio-page" id="main-content">
			<section className="studio-hero studio-hero--compact">
				<p className="section-kicker">Run history</p>
				<h1>Every storefront variant run is persisted.</h1>
				<p>
					Open a run to inspect previews, diffs, validation receipts, and
					transcripts.
				</p>
			</section>
			<RunHistory runs={runs} />
		</main>
	);
}
