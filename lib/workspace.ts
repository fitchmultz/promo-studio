import type { Dirent } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/config";

export {
	CANONICAL_WORKSPACE_DIR,
	formatWorkspacePathForDisplay,
	LEGACY_WORKSPACE_DIR,
	resolveWorkspacePathForIo,
} from "@/lib/workspace-paths";

const IGNORED_WORKSPACE_NAMES = new Set(["node_modules", "dist", ".DS_Store"]);

export function workspaceStorefrontPath(runId: string) {
	return path.join(paths.workspaces, `run-${runId}`, "storefront");
}

export async function createVariantWorkspace(runId: string) {
	const destination = workspaceStorefrontPath(runId);
	await rm(path.dirname(destination), { recursive: true, force: true });
	await mkdir(path.dirname(destination), { recursive: true });
	await cp(paths.templateStorefront, destination, {
		recursive: true,
		filter: (source) => !IGNORED_WORKSPACE_NAMES.has(path.basename(source)),
	});
	await mkdir(path.join(destination, "artifact"), { recursive: true });
	return destination;
}

async function listFiles(root: string, relative = ""): Promise<string[]> {
	const directory = path.join(root, relative);
	let entries: Dirent[];
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return [];
	}
	const files = await Promise.all(
		entries
			.filter((entry) => !IGNORED_WORKSPACE_NAMES.has(entry.name))
			.map(async (entry) => {
				const entryRelative = path.join(relative, entry.name);
				if (entry.isDirectory()) return listFiles(root, entryRelative);
				if (entry.isFile()) return [entryRelative.split(path.sep).join("/")];
				return [];
			}),
	);
	return files.flat().sort();
}

export async function detectChangedFiles(workspacePath: string) {
	const [templateFiles, workspaceFiles] = await Promise.all([
		listFiles(paths.templateStorefront),
		listFiles(workspacePath),
	]);
	const allFiles = Array.from(
		new Set([...templateFiles, ...workspaceFiles]),
	).sort();
	const changed: string[] = [];
	for (const file of allFiles) {
		const templateFile = path.join(paths.templateStorefront, file);
		const workspaceFile = path.join(workspacePath, file);
		const [templateInfo, workspaceInfo] = await Promise.all([
			stat(templateFile).catch(() => null),
			stat(workspaceFile).catch(() => null),
		]);
		if (!templateInfo || !workspaceInfo) {
			changed.push(file);
			continue;
		}
		const [templateContent, workspaceContent] = await Promise.all([
			readFile(templateFile, "utf8"),
			readFile(workspaceFile, "utf8"),
		]);
		if (templateContent !== workspaceContent) changed.push(file);
	}
	return changed;
}

export async function resetWorkspaces() {
	await rm(paths.workspaces, { recursive: true, force: true });
	await mkdir(paths.workspaces, { recursive: true });
}
