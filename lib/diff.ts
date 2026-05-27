import { readFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/config";
import { isSafeWorkspaceFile } from "@/lib/validation";

export type DiffLineKind = "added" | "removed" | "neutral";

export interface DiffLine {
	kind: DiffLineKind;
	text: string;
	key: string;
}

export interface DiffEntry {
	file: string;
	diffLines: DiffLine[];
}

function isMissingFileError(error: unknown) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function readMaybe(filePath: string) {
	try {
		return await readFile(filePath, "utf8");
	} catch (error) {
		if (isMissingFileError(error)) return "";
		throw error;
	}
}

function diffLine(kind: DiffLineKind, text: string, key: string): DiffLine {
	return { kind, text, key };
}

export function summarizeDiff(before: string, after: string): DiffLine[] {
	if (!before)
		return after
			.split(/\r?\n/)
			.slice(0, 80)
			.map((line, lineNumber) =>
				diffLine("added", `+ ${line}`, `added-${lineNumber}`),
			);
	if (!after)
		return before
			.split(/\r?\n/)
			.slice(0, 80)
			.map((line, lineNumber) =>
				diffLine("removed", `- ${line}`, `removed-${lineNumber}`),
			);
	const beforeLines = before.split(/\r?\n/);
	const afterLines = after.split(/\r?\n/);
	const max = Math.max(beforeLines.length, afterLines.length);
	const rows: DiffLine[] = [];
	for (let index = 0; index < max; index += 1) {
		if (beforeLines[index] !== afterLines[index]) {
			if (beforeLines[index] !== undefined)
				rows.push(
					diffLine("removed", `- ${beforeLines[index]}`, `removed-${index}`),
				);
			if (afterLines[index] !== undefined)
				rows.push(
					diffLine("added", `+ ${afterLines[index]}`, `added-${index}`),
				);
		}
		if (rows.length > 120) break;
	}
	return rows.length
		? rows
		: [diffLine("neutral", "No textual changes detected.", "neutral-empty")];
}

export async function buildDiffEntries(
	workspacePath: string,
	changedFiles: string[],
): Promise<DiffEntry[]> {
	return Promise.all(
		changedFiles.map(async (file) => {
			if (!isSafeWorkspaceFile(file)) {
				throw new Error(`Unsafe changed file path: ${file}`);
			}
			const [before, after] = await Promise.all([
				readMaybe(path.join(paths.templateStorefront, file)),
				readMaybe(path.join(workspacePath, file)),
			]);
			return { file, diffLines: summarizeDiff(before, after) };
		}),
	);
}
