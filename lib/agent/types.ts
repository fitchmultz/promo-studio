import type {
	CodexAuthMode,
	CodexReasoningEffort,
	CodexRuntime,
} from "@/lib/config";

export type AgentCore = "codex" | "pi" | "cursor";
export type CodexAgentHarness = "sdk" | "exec";
export type PiAgentHarness = "json";
export type CursorAgentHarness = "sdk";
export type AgentHarness =
	| CodexAgentHarness
	| PiAgentHarness
	| CursorAgentHarness;

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

export interface CursorRuntimeOptions {
	input: string;
	requestedModel: string;
	timeoutMs: number;
	workspace: string;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}

export type VariantCursorSdkRunner = (
	options: CursorRuntimeOptions,
) => Promise<ProcessResult>;

interface BaseAgentRuntimeSpec {
	core: AgentCore;
	harness: AgentHarness;
	requestedModel: string;
	requestedEffort: string;
	selectedModel: string;
	selectedEffort: string;
	legacyRuntime: CodexRuntime | "json" | "cursor-sdk";
}

export interface CodexAgentRuntimeSpec extends BaseAgentRuntimeSpec {
	core: "codex";
	harness: CodexAgentHarness;
	requestedAuthMode: CodexAuthMode;
	requestedEffort: CodexReasoningEffort | "";
	legacyRuntime: CodexRuntime;
}

export interface PiAgentRuntimeSpec extends BaseAgentRuntimeSpec {
	core: "pi";
	harness: PiAgentHarness;
	requestedEffort: "";
	legacyRuntime: "json";
}

export interface CursorAgentRuntimeSpec extends BaseAgentRuntimeSpec {
	core: "cursor";
	harness: CursorAgentHarness;
	requestedEffort: "";
	legacyRuntime: "cursor-sdk";
}

export type AgentRuntimeSpec =
	| CodexAgentRuntimeSpec
	| PiAgentRuntimeSpec
	| CursorAgentRuntimeSpec;

export interface AgentExecutionResult {
	result: ProcessResult;
	codexAuthSelection?: { selectedMode: "subscription" | "api-key" };
}

export interface ExecuteVariantRunOptions {
	processRunner?: VariantProcessRunner;
	codexSdkRunner?: VariantSdkRunner;
	cursorSdkRunner?: VariantCursorSdkRunner;
}
