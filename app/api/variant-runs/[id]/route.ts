import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseAgentEvents } from "@/lib/agent/transcript";
import { prisma } from "@/lib/db";
import {
	serializeVariantRunLive,
	variantRunLiveSelect,
} from "@/lib/variant-run-dto";

import { readLiveTranscriptForPoll } from "@/lib/agent/transcript-store";

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
	const pollTranscript = await readLiveTranscriptForPoll(run.id);
	return NextResponse.json({
		run: serializeVariantRunLive(run),
		events: parseAgentEvents(pollTranscript),
	});
}
