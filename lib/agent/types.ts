import type {
	CodexAuthMode,
	CodexReasoningEffort,
	CodexRuntime,
} from "@/lib/config";

export type AgentCore = "codex" | "pi";
export type AgentHarness = "sdk" | "exec" | "json";

export interface ProcessResult {
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
}

export interface ProcessOptions {
	cwd: string;
	env?: NodeJS.ProcessEnv;
	input?: string;
	timeoutMs?: number;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}

export interface RuntimeOptions {
	input: string;
	keySource: "CODEX_API_KEY" | "OPENAI_API_KEY" | "none";
	requestedEffort: CodexReasoningEffort | "";
	requestedModel: string;
	timeoutMs: number;
	workspace: string;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}

export type VariantProcessRunner = (
	command: string,
	args: string[],
	options: ProcessOptions,
) => Promise<ProcessResult>;

export type VariantSdkRunner = (
	options: RuntimeOptions,
) => Promise<ProcessResult>;

export interface AgentSelection {
	core: AgentCore;
	harness: AgentHarness;
	requestedAuthMode: CodexAuthMode;
	requestedModel: string;
	requestedEffort: CodexReasoningEffort | "";
	selectedModel: string;
	selectedEffort: string;
}

export interface ExecuteVariantRunOptions {
	processRunner?: VariantProcessRunner;
	codexSdkRunner?: VariantSdkRunner;
}

/** Maps harness to the legacy codexRuntime column for receipts and filters. */
export function legacyCodexRuntime(
	core: AgentCore,
	harness: AgentHarness,
): CodexRuntime | "json" {
	if (core === "pi" && harness === "json") return "json";
	if (harness === "exec") return "exec";
	return "sdk";
}
