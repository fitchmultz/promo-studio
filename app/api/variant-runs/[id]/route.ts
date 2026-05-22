import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseCodexEvents } from "@/lib/codex-runner";
import { resolveFullTranscript } from "@/lib/agent/transcript-store";
import { prisma } from "@/lib/db";
import { parseStringArrayJson } from "@/lib/json";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await requireUser();
	const { id } = await params;
	const run = await prisma.variantRun.findUnique({
		where: { id },
		include: { product: true, user: true },
	});
	if (!run)
		return NextResponse.json({ error: "Run not found." }, { status: 404 });
	if (user.role !== "admin" && run.userId !== user.id) {
		return NextResponse.json({ error: "Forbidden." }, { status: 403 });
	}
	// Live activity poll: recent JSONL tail in SQLite (no truncation markers).
	// Transcript tab loads the full on-disk JSONL via server render when the run finishes.
	const pollTranscript =
		run.status === "running"
			? run.transcript
			: await resolveFullTranscript(run.id, run.transcript);
	return NextResponse.json({
		run: {
			...run,
			transcript: pollTranscript,
			hasPreview: Boolean(run.previewHtml?.trim()),
		},
		events: parseCodexEvents(pollTranscript),
		changedFiles: parseStringArrayJson(run.changedFiles),
	});
}
