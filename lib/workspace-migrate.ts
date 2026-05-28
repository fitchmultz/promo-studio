import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { paths, projectRoot } from "@/lib/config";
import { prisma } from "@/lib/db";
import { WORKSPACE_DIR_NAME } from "@/lib/workspace-constants";

const LEGACY_WORKSPACE_DIR = "codex-workspaces";

/** One-time rewrite of stored paths and invocation strings (no runtime shim). */
export async function migrateLegacyWorkspaceRecords() {
	const runs = await prisma.variantRun.findMany({
		where: {
			OR: [
				{ workspacePath: { contains: LEGACY_WORKSPACE_DIR } },
				{ codexCommand: { contains: LEGACY_WORKSPACE_DIR } },
			],
		},
		select: { id: true, workspacePath: true, codexCommand: true },
	});
	for (const run of runs) {
		await prisma.variantRun.update({
			where: { id: run.id },
			data: {
				workspacePath: run.workspacePath.replaceAll(
					LEGACY_WORKSPACE_DIR,
					WORKSPACE_DIR_NAME,
				),
				codexCommand: run.codexCommand.replaceAll(
					LEGACY_WORKSPACE_DIR,
					WORKSPACE_DIR_NAME,
				),
			},
		});
	}
	return runs.length;
}

/** Move any on-disk `codex-workspaces/run-*` trees into `agent-workspaces/`. */
export async function migrateLegacyWorkspaceDirs() {
	const legacyRoot = path.join(projectRoot, LEGACY_WORKSPACE_DIR);
	const canonicalRoot = paths.workspaces;
	try {
		await stat(legacyRoot);
	} catch {
		return 0;
	}

	await mkdir(canonicalRoot, { recursive: true });
	const entries = await readdir(legacyRoot, { withFileTypes: true });
	let moved = 0;
	for (const entry of entries) {
		if (!entry.isDirectory() || !entry.name.startsWith("run-")) continue;
		const from = path.join(legacyRoot, entry.name);
		const to = path.join(canonicalRoot, entry.name);
		try {
			await stat(to);
			await rm(from, { recursive: true, force: true });
		} catch {
			await rename(from, to);
			moved += 1;
		}
	}
	try {
		const remaining = await readdir(legacyRoot);
		if (remaining.length === 0) {
			await rm(legacyRoot, { recursive: true, force: true });
		}
	} catch {
		// ignore cleanup errors
	}
	return moved;
}
