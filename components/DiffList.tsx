import type { DiffEntry } from "@/lib/diff";

export function ChangedFilesList({ files }: { files: string[] }) {
	if (!files.length) return null;
	return (
		<>
			<p className="muted code-diff-meta">
				{files.length} changed file{files.length === 1 ? "" : "s"} detected
				{files.length === 1 ? "" : " so far"}.
			</p>
			<ul className="changed-files-list" aria-label="Changed files">
				{files.map((file) => (
					<li key={file}>
						<code>{file}</code>
					</li>
				))}
			</ul>
		</>
	);
}

export function DiffList({ diffs }: { diffs: DiffEntry[] }) {
	if (!diffs.length) return null;
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
