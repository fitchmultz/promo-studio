import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/config";
import {
	MAX_DB_TRANSCRIPT_CHARS,
	MAX_POLL_TRANSCRIPT_CHARS,
	MAX_PROCESS_OUTPUT_CHARS,
	tailJsonlForPoll,
} from "@/lib/agent/process";
import { prisma } from "@/lib/db";

export function runTranscriptPath(runId: string) {
	return path.join(paths.artifacts, "transcripts", `${runId}.jsonl`);
}

export async function appendRunTranscriptLine(runId: string, line: string) {
	const filePath = runTranscriptPath(runId);
	await mkdir(path.dirname(filePath), { recursive: true });
	await appendFile(filePath, `${line}\n`, "utf8");
}

export async function readRunTranscriptFile(
	runId: string,
): Promise<string | null> {
	try {
		return await readFile(runTranscriptPath(runId), "utf8");
	} catch {
		return null;
	}
}

export async function runTranscriptFileByteLength(
	runId: string,
): Promise<number | null> {
	try {
		const info = await stat(runTranscriptPath(runId));
		return info.size;
	} catch {
		return null;
	}
}

function completeJsonlTail(tail: string, transcriptLength: number) {
	if (transcriptLength <= MAX_PROCESS_OUTPUT_CHARS) return tail;
	const firstBreak = tail.search(/\r?\n/);
	return firstBreak >= 0 ? tail.slice(firstBreak + 1) : "";
}

export function transcriptBodyForPoll(full: string): string {
	return tailJsonlForPoll(full, MAX_POLL_TRANSCRIPT_CHARS);
}

async function readDbTranscriptTail(runId: string) {
	const rows = await prisma.$queryRaw<
		Array<{ transcriptTail: string | null; transcriptLength: number | bigint }>
	>`
		SELECT substr("transcript", -${MAX_PROCESS_OUTPUT_CHARS}) AS "transcriptTail",
		       length("transcript") AS "transcriptLength"
		FROM "VariantRun"
		WHERE "id" = ${runId}
		LIMIT 1
	`;
	const row = rows[0];
	return completeJsonlTail(
		row?.transcriptTail ?? "",
		Number(row?.transcriptLength ?? 0),
	);
}

/** Live poll source: prefer the on-disk JSONL file while the worker is streaming. */
export async function readLiveTranscriptForPoll(
	runId: string,
): Promise<string> {
	const [file, dbTail] = await Promise.all([
		readRunTranscriptFile(runId),
		readDbTranscriptTail(runId),
	]);
	const fileTail = file ? transcriptBodyForPoll(file) : "";
	if (fileTail.length >= dbTail.length) return fileTail;
	return dbTail;
}

/** Full trace for UI/API; prefers the on-disk JSONL file written during the run. */
export async function resolveFullTranscript(
	runId: string,
	dbTranscript: string,
): Promise<string> {
	const file = await readRunTranscriptFile(runId);
	const body = (file ?? dbTranscript).trim();
	return body;
}

/** What we store in SQLite — full text when small, otherwise a recent tail (no markers). */
export function transcriptBodyForDb(full: string): string {
	if (full.length <= MAX_DB_TRANSCRIPT_CHARS) return full;
	return tailJsonlForPoll(full, MAX_DB_TRANSCRIPT_CHARS);
}
