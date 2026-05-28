export const LEGACY_WORKSPACE_DIR = "codex-workspaces";
export const CANONICAL_WORKSPACE_DIR = "agent-workspaces";

/** Map legacy DB/on-disk paths to the canonical agent-workspaces root for I/O. */
export function resolveWorkspacePathForIo(workspacePath: string): string {
	return workspacePath.replaceAll(
		LEGACY_WORKSPACE_DIR,
		CANONICAL_WORKSPACE_DIR,
	);
}

/** Normalize legacy on-disk dir name for all UI surfaces (receipts, shell output, lists). */
export function formatWorkspacePathForDisplay(workspacePath: string): string {
	return resolveWorkspacePathForIo(workspacePath);
}
