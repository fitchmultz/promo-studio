import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseCodexEvents } from "@/lib/codex-runner";
import { prisma } from "@/lib/db";
import {
	serializeVariantRunLive,
	variantRunLiveSelect,
} from "@/lib/variant-run-dto";

const LIVE_TRANSCRIPT_TAIL_CHARS = 120_000;

interface TranscriptTailRow {
	transcriptTail: string | null;
	transcriptLength: number | bigint | null;
}

function completeJsonlTail(row: TranscriptTailRow | undefined) {
	const tail = row?.transcriptTail ?? "";
	const transcriptLength = Number(row?.transcriptLength ?? 0);
	if (transcriptLength <= LIVE_TRANSCRIPT_TAIL_CHARS) return tail;
	const firstBreak = tail.search(/\r?\n/);
	return firstBreak >= 0 ? tail.slice(firstBreak + 1) : "";
}

async function readLiveTranscriptTail(runId: string) {
	const rows = await prisma.$queryRaw<TranscriptTailRow[]>`
		SELECT substr("transcript", -${LIVE_TRANSCRIPT_TAIL_CHARS}) AS "transcriptTail",
		       length("transcript") AS "transcriptLength"
		FROM "VariantRun"
		WHERE "id" = ${runId}
		LIMIT 1
	`;
	return completeJsonlTail(rows[0]);
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await requireUser();
	const { id } = await params;
	const run = await prisma.variantRun.findUnique({
		where: { id },
		select: variantRunLiveSelect,
	});
	if (!run)
		return NextResponse.json({ error: "Run not found." }, { status: 404 });
	if (user.role !== "admin" && run.userId !== user.id) {
		return NextResponse.json({ error: "Forbidden." }, { status: 403 });
	}
	const pollTranscript = await readLiveTranscriptTail(run.id);
	return NextResponse.json({
		run: serializeVariantRunLive(run),
		events: parseCodexEvents(pollTranscript),
	});
}
