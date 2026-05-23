import { readFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/config";
import { isSafeWorkspaceFile } from "@/lib/validation";

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

type DiffLineKind = "added" | "removed" | "neutral";

interface DiffLine {
	kind: DiffLineKind;
	text: string;
	key: string;
}

function diffLine(kind: DiffLineKind, text: string, key: string): DiffLine {
	return { kind, text, key };
}

export function summarizeDiff(before: string, after: string) {
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

export async function DiffViewer({
	workspacePath,
	changedFiles,
}: {
	workspacePath: string;
	changedFiles: string[];
}) {
	const diffs = await Promise.all(
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
	return (
		<div className="diff-list">
			{diffs.map((entry) => (
				<details key={entry.file} open>
					<summary>
						{entry.file}
						<span className="sr-only"> (diff with additions and removals)</span>
					</summary>
					<pre title={`Diff for ${entry.file}`}>
						{entry.diffLines.map((line) => (
							<span
								className={`diff-line diff-line--${line.kind}`}
								key={line.key}
								title={
									line.kind === "added"
										? `Addition: ${line.text.slice(2)}`
										: line.kind === "removed"
											? `Removal: ${line.text.slice(2)}`
											: line.text
								}
							>
								{line.text}
							</span>
						))}
					</pre>
				</details>
			))}
		</div>
	);
}
