import type { ThreadOptions } from "@openai/codex-sdk";

type CodexAutomationThreadOptions = Pick<
	ThreadOptions,
	| "approvalPolicy"
	| "networkAccessEnabled"
	| "sandboxMode"
	| "skipGitRepoCheck"
	| "webSearchMode"
>;

const CODEX_EXEC_WORKSPACE_PLACEHOLDER = "<workspace>";

type CodexExecArgSpec = {
	args: readonly string[];
	helpFlag: string;
};

export const CODEX_AUTOMATION_POLICY = {
	approvalPolicy: "never",
	networkAccessEnabled: false,
	sandboxMode: "workspace-write",
	skipGitRepoCheck: true,
	webSearchMode: "disabled",
} as const satisfies CodexAutomationThreadOptions;

export const CODEX_EXEC_AUTOMATION_ARG_SPEC = [
	{ args: ["--json"], helpFlag: "--json" },
	{ args: ["--ephemeral"], helpFlag: "--ephemeral" },
	{ args: ["--ignore-user-config"], helpFlag: "--ignore-user-config" },
	{ args: ["--ignore-rules"], helpFlag: "--ignore-rules" },
	{
		args: ["--sandbox", CODEX_AUTOMATION_POLICY.sandboxMode],
		helpFlag: "--sandbox",
	},
	{ args: ["--skip-git-repo-check"], helpFlag: "--skip-git-repo-check" },
	{ args: ["--cd", CODEX_EXEC_WORKSPACE_PLACEHOLDER], helpFlag: "--cd" },
	{
		args: [
			"-c",
			`approval_policy=${JSON.stringify(CODEX_AUTOMATION_POLICY.approvalPolicy)}`,
		],
		helpFlag: "--config",
	},
	{
		args: [
			"-c",
			`sandbox_workspace_write.network_access=${CODEX_AUTOMATION_POLICY.networkAccessEnabled}`,
		],
		helpFlag: "--config",
	},
	{
		args: [
			"-c",
			`web_search=${JSON.stringify(CODEX_AUTOMATION_POLICY.webSearchMode)}`,
		],
		helpFlag: "--config",
	},
] as const satisfies readonly CodexExecArgSpec[];

export function codexAutomationThreadOptions(): CodexAutomationThreadOptions {
	return { ...CODEX_AUTOMATION_POLICY };
}

export function codexAutomationConfigArgs(): string[] {
	return CODEX_EXEC_AUTOMATION_ARG_SPEC.filter(
		(spec) => spec.args[0] === "-c",
	).flatMap((spec) => [...spec.args]);
}

export function codexAutomationExecArgs(workspace: string): string[] {
	return CODEX_EXEC_AUTOMATION_ARG_SPEC.flatMap((spec) =>
		spec.args.map((arg) =>
			arg === CODEX_EXEC_WORKSPACE_PLACEHOLDER ? workspace : arg,
		),
	);
}

export function codexExecRequiredHelpFlags(): string[] {
	return [
		...new Set(CODEX_EXEC_AUTOMATION_ARG_SPEC.map((spec) => spec.helpFlag)),
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
