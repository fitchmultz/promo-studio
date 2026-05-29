import path from "node:path";
import type { LocalAgentOptions } from "@cursor/sdk";

export const CURSOR_AUTOMATION_MODE = "agent" as const;
const CURSOR_LOCAL_STORE_DIR = ".cursor-sdk-store";

export function cursorLocalStoreRoot(workspace: string): string {
	return path.join(path.dirname(workspace), CURSOR_LOCAL_STORE_DIR);
}

export function cursorAutomationLocalOptions(
	workspace: string,
): LocalAgentOptions {
	return {
		cwd: workspace,
		sandboxOptions: { enabled: true },
	};
}

export function cursorAutomationDescriptorParts(
	workspace: string,
	modelId: string,
): string[] {
	return [
		`cwd=${workspace}`,
		`mode=${CURSOR_AUTOMATION_MODE}`,
		"sandboxOptions.enabled=true",
		`local.store=jsonl:${cursorLocalStoreRoot(workspace)}`,
		`model=${modelId}`,
	];
}
