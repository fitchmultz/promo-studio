import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveFullTranscript } from "@/lib/agent/transcript-store";
import { prisma } from "@/lib/db";

const DEFAULT_TAIL_LINES = 120;
const MAX_TAIL_LINES = 2000;

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await requireUser();
	const { id } = await params;
	const run = await prisma.variantRun.findUnique({ where: { id } });
	if (!run)
		return NextResponse.json({ error: "Run not found." }, { status: 404 });
	if (user.role !== "admin" && run.userId !== user.id) {
		return NextResponse.json({ error: "Forbidden." }, { status: 403 });
	}

	const url = new URL(request.url);
	const tailParam = Number(url.searchParams.get("tail") ?? DEFAULT_TAIL_LINES);
	const tailLines = Number.isFinite(tailParam)
		? Math.min(Math.max(1, Math.floor(tailParam)), MAX_TAIL_LINES)
		: DEFAULT_TAIL_LINES;

	const full = await resolveFullTranscript(run.id, run.transcript);
	const lines = full.split(/\r?\n/).filter((line) => line.trim().length > 0);
	const tail = lines.slice(-tailLines).join("\n");

	return NextResponse.json({
		text: tail,
		totalLines: lines.length,
		shownLines: Math.min(tailLines, lines.length),
		truncated: lines.length > tailLines,
		agentCore: run.agentCore,
		invocation: run.codexCommand,
	});
}
