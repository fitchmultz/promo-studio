import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/config";
import { tailJsonlForPoll, MAX_DB_TRANSCRIPT_CHARS } from "@/lib/agent/process";

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
