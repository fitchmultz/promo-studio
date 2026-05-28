import type { LocalAgentOptions } from "@cursor/sdk";

export const CURSOR_AUTOMATION_MODE = "agent" as const;

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
		`model=${modelId}`,
	];
}
