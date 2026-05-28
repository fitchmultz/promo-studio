import type { Prisma, VariantRun } from "@prisma/client";
import { env } from "@/lib/config";
import { prisma } from "@/lib/db";
import type { ExecuteVariantRunOptions } from "@/lib/agent/types";

function staleRunCutoff(now = new Date()) {
	const staleAfterMs = Math.max(env.CODEX_TIMEOUT_MS, env.PI_TIMEOUT_MS) * 2;
	return new Date(now.getTime() - staleAfterMs);
}

export async function recoverStaleVariantRuns(now = new Date()) {
	await prisma.variantRun.updateMany({
		where: {
			status: "running",
			startedAt: { lt: staleRunCutoff(now) },
		},
		data: {
			status: "failed",
			error: "Run worker stopped before finalizing this variant.",
			validationResult:
				"Validation: failed\nRun worker stopped before finalizing this variant.",
			outputSummary:
				"The agent run did not produce a finalized storefront variant.",
			completedAt: now,
		},
	});
}

export async function claimVariantRun(runId: string) {
	const claimed = await prisma.variantRun.updateMany({
		where: { id: runId, status: "queued" },
		data: { status: "running", startedAt: new Date() },
	});
	if (!claimed.count) {
		const existing = await prisma.variantRun.findUnique({
			where: { id: runId },
		});
		if (!existing) throw new Error(`Variant run ${runId} was not found.`);
		return null;
	}
	return prisma.variantRun.findUniqueOrThrow({ where: { id: runId } });
}

export async function finalizeVariantRun(
	runId: string,
	data: Prisma.VariantRunUpdateArgs["data"],
): Promise<VariantRun | null> {
	const finalized = await prisma.variantRun.updateMany({
		where: { id: runId, status: "running" },
		data,
	});
	if (!finalized.count) {
		return prisma.variantRun.findUnique({ where: { id: runId } });
	}
	return prisma.variantRun.findUniqueOrThrow({ where: { id: runId } });
}

export async function drainQueuedVariantRunQueue(
	execute: (
		runId: string,
		options: ExecuteVariantRunOptions,
	) => Promise<VariantRun | null>,
	options: ExecuteVariantRunOptions = {},
	limit = 5,
) {
	await recoverStaleVariantRuns();
	const queuedRuns = await prisma.variantRun.findMany({
		where: { status: "queued" },
		select: { id: true },
		orderBy: { startedAt: "asc" },
		take: limit,
	});
	for (const queuedRun of queuedRuns) {
		await execute(queuedRun.id, options);
	}
	return queuedRuns.length;
}
