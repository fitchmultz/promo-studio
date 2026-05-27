import { DiffList } from "@/components/DiffList";
import { buildDiffEntries } from "@/lib/diff";

export { summarizeDiff } from "@/lib/diff";

export async function DiffViewer({
	workspacePath,
	changedFiles,
}: {
	workspacePath: string;
	changedFiles: string[];
}) {
	const diffs = await buildDiffEntries(workspacePath, changedFiles);
	return <DiffList diffs={diffs} />;
}
