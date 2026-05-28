import type {
	CodexAuthMode,
	CodexReasoningEffort,
	CodexRuntime,
} from "@/lib/config";

export type AgentCore = "codex" | "pi";
export type CodexAgentHarness = "sdk" | "exec";
export type PiAgentHarness = "json";
export type AgentHarness = CodexAgentHarness | PiAgentHarness;

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

export interface CodexAgentRuntimeSpec {
	core: "codex";
	harness: CodexAgentHarness;
	requestedAuthMode: CodexAuthMode;
	requestedModel: string;
	requestedEffort: CodexReasoningEffort | "";
	selectedModel: string;
	selectedEffort: string;
	legacyRuntime: CodexRuntime;
}

export interface PiAgentRuntimeSpec {
	core: "pi";
	harness: PiAgentHarness;
	requestedAuthMode: CodexAuthMode;
	requestedModel: string;
	requestedEffort: "";
	selectedModel: string;
	selectedEffort: string;
	legacyRuntime: "json";
}

export type AgentRuntimeSpec = CodexAgentRuntimeSpec | PiAgentRuntimeSpec;

export interface ExecuteVariantRunOptions {
	processRunner?: VariantProcessRunner;
	codexSdkRunner?: VariantSdkRunner;
}
