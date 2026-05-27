import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildDiffEntries } from "@/lib/diff";
import { prisma } from "@/lib/db";
import { parseStringArrayJson } from "@/lib/json";
import { variantRunDiffSelect } from "@/lib/variant-run-dto";
import { detectChangedFiles } from "@/lib/workspace";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await requireUser();
	const { id } = await params;
	const run = await prisma.variantRun.findUnique({
		where: { id },
		select: variantRunDiffSelect,
	});
	if (!run)
		return NextResponse.json({ error: "Run not found." }, { status: 404 });
	if (user.role !== "admin" && run.userId !== user.id) {
		return NextResponse.json({ error: "Forbidden." }, { status: 403 });
	}

	const persistedChangedFiles = parseStringArrayJson(run.changedFiles);
	const changedFiles =
		run.status === "queued" || run.status === "running"
			? await detectChangedFiles(run.workspacePath)
			: persistedChangedFiles;
	const diffs = changedFiles.length
		? await buildDiffEntries(run.workspacePath, changedFiles)
		: [];

	return NextResponse.json({ status: run.status, changedFiles, diffs });
}
