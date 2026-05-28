import type { ThreadOptions } from "@openai/codex-sdk";

type CodexAutomationThreadOptions = Pick<
	ThreadOptions,
	| "approvalPolicy"
	| "networkAccessEnabled"
	| "sandboxMode"
	| "skipGitRepoCheck"
	| "webSearchMode"
>;

export const CODEX_AUTOMATION_POLICY = {
	approvalPolicy: "never",
	networkAccessEnabled: false,
	sandboxMode: "workspace-write",
	skipGitRepoCheck: true,
	webSearchMode: "disabled",
} as const satisfies CodexAutomationThreadOptions;

export function codexAutomationThreadOptions(): CodexAutomationThreadOptions {
	return { ...CODEX_AUTOMATION_POLICY };
}

export function codexAutomationConfigArgs(): string[] {
	return [
		"-c",
		`approval_policy=${JSON.stringify(CODEX_AUTOMATION_POLICY.approvalPolicy)}`,
		"-c",
		`sandbox_workspace_write.network_access=${CODEX_AUTOMATION_POLICY.networkAccessEnabled}`,
		"-c",
		`web_search=${JSON.stringify(CODEX_AUTOMATION_POLICY.webSearchMode)}`,
	];
}

export function codexAutomationExecArgs(workspace: string): string[] {
	return [
		"--sandbox",
		CODEX_AUTOMATION_POLICY.sandboxMode,
		...(CODEX_AUTOMATION_POLICY.skipGitRepoCheck
			? ["--skip-git-repo-check"]
			: []),
		"--cd",
		workspace,
		...codexAutomationConfigArgs(),
	];
}

export function codexAutomationDescriptorParts(): string[] {
	return [
		`sandboxMode=${CODEX_AUTOMATION_POLICY.sandboxMode}`,
		`skipGitRepoCheck=${CODEX_AUTOMATION_POLICY.skipGitRepoCheck}`,
		`approvalPolicy=${CODEX_AUTOMATION_POLICY.approvalPolicy}`,
		`networkAccessEnabled=${CODEX_AUTOMATION_POLICY.networkAccessEnabled}`,
		`webSearchMode=${CODEX_AUTOMATION_POLICY.webSearchMode}`,
	];
}
