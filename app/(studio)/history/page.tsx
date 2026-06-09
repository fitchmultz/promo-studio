import type { Metadata } from "next";
import Link from "next/link";
import { RunHistory } from "@/components/RunHistory";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
	DEFAULT_RUN_LIST_LIMIT,
	variantRunCursorPageArgs,
} from "@/lib/variant-run-pagination";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Run History",
};

const HISTORY_PAGE_SIZE = DEFAULT_RUN_LIST_LIMIT;

export default async function HistoryPage({
	searchParams,
}: {
	searchParams: Promise<{ cursor?: string }>;
}) {
	const user = await requireUser();
	const { cursor: requestedCursor } = await searchParams;
	const where = user.role === "admin" ? undefined : { userId: user.id };
	const cursorExists = requestedCursor
		? await prisma.variantRun.findFirst({
				where: { id: requestedCursor, ...where },
				select: { id: true },
			})
		: null;
	const cursor = cursorExists ? (requestedCursor ?? null) : null;
	const runsPage = await prisma.variantRun.findMany({
		where,
		include: { product: true },
		...variantRunCursorPageArgs(cursor, HISTORY_PAGE_SIZE),
	});
	const hasMore = runsPage.length > HISTORY_PAGE_SIZE;
	const runs = runsPage.slice(0, HISTORY_PAGE_SIZE);
	const nextCursor = hasMore ? runs.at(-1)?.id : null;
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
			<nav className="history-pagination" aria-label="Run history pagination">
				{cursor ? (
					<Link className="button secondary-button" href="/history">
						Latest runs
					</Link>
				) : null}
				{nextCursor ? (
					<Link
						className="button secondary-button"
						href={`/history?cursor=${encodeURIComponent(nextCursor)}`}
					>
						Load older runs
					</Link>
				) : null}
			</nav>
		</main>
	);
}
