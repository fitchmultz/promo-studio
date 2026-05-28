import { cursorApiKeyConfigured } from "@/lib/config";
import {
	defaultCodexSdkRunner,
	resolveCodexSelection,
	runCodexWithFallback,
} from "@/lib/agent/codex-adapter";
import {
	defaultCursorSdkRunner,
	runCursorRuntime,
} from "@/lib/agent/cursor-adapter";
import { runPiRuntime } from "@/lib/agent/pi-adapter";
import type {
	AgentCore,
	AgentExecutionResult,
	AgentRuntimeSpec,
	ExecuteVariantRunOptions,
	VariantProcessRunner,
} from "@/lib/agent/types";

export interface AgentRuntimeExecutionContext {
	input: string;
	processRunner: VariantProcessRunner;
	runId: string;
	workspace: string;
	timeoutMs: number;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
	executeOptions: ExecuteVariantRunOptions;
}

export interface AgentCoreRuntimeDefinition {
	core: AgentCore;
	validateBeforeCreate?: (runtimeSpec: AgentRuntimeSpec) => void;
	execute: (
		runtimeSpec: AgentRuntimeSpec,
		context: AgentRuntimeExecutionContext,
	) => Promise<AgentExecutionResult>;
}

function codexSpec(runtimeSpec: AgentRuntimeSpec) {
	if (runtimeSpec.core !== "codex") {
		throw new Error(`Expected Codex runtime spec, got ${runtimeSpec.core}.`);
	}
	return runtimeSpec;
}

export const AGENT_RUNTIME_REGISTRY = {
	codex: {
		core: "codex",
		validateBeforeCreate(runtimeSpec) {
			const spec = codexSpec(runtimeSpec);
			const selection = resolveCodexSelection(spec.requestedAuthMode);
			if (
				selection.selectedMode === "api-key" &&
				selection.keySource === "none"
			) {
				throw new Error(
					"API-key mode requested, but neither CODEX_API_KEY nor OPENAI_API_KEY is configured.",
				);
			}
		},
		async execute(runtimeSpec, context) {
			const spec = codexSpec(runtimeSpec);
			const agentResult = await runCodexWithFallback({
				runtime: spec.harness,
				input: context.input,
				processRunner: context.processRunner,
				sdkRunner:
					context.executeOptions.codexSdkRunner ?? defaultCodexSdkRunner,
				requestedAuthMode: spec.requestedAuthMode,
				requestedModel: spec.requestedModel,
				requestedEffort: spec.requestedEffort,
				selection: resolveCodexSelection(spec.requestedAuthMode),
				workspace: context.workspace,
				timeoutMs: context.timeoutMs,
				onStdoutLine: context.onStdoutLine,
				onStderrLine: context.onStderrLine,
			});
			return {
				result: agentResult.result,
				codexAuthSelection: {
					selectedMode: agentResult.selection.selectedMode,
				},
			};
		},
	},
	pi: {
		core: "pi",
		async execute(runtimeSpec, context) {
			const result = await runPiRuntime({
				input: context.input,
				processRunner: context.processRunner,
				requestedModel: runtimeSpec.requestedModel,
				runId: context.runId,
				workspace: context.workspace,
				timeoutMs: context.timeoutMs,
				onStdoutLine: context.onStdoutLine,
				onStderrLine: context.onStderrLine,
			});
			return { result };
		},
	},
	cursor: {
		core: "cursor",
		validateBeforeCreate() {
			if (!cursorApiKeyConfigured()) {
				throw new Error(
					"CURSOR_API_KEY is required for Cursor SDK storefront variant runs.",
				);
			}
		},
		async execute(runtimeSpec, context) {
			const result = await runCursorRuntime({
				input: context.input,
				cursorSdkRunner:
					context.executeOptions.cursorSdkRunner ?? defaultCursorSdkRunner,
				requestedModel: runtimeSpec.requestedModel,
				workspace: context.workspace,
				timeoutMs: context.timeoutMs,
				onStdoutLine: context.onStdoutLine,
				onStderrLine: context.onStderrLine,
			});
			return { result };
		},
	},
} satisfies Record<AgentCore, AgentCoreRuntimeDefinition>;

export function agentRuntimeDefinition(
	core: AgentCore,
): AgentCoreRuntimeDefinition {
	return AGENT_RUNTIME_REGISTRY[core];
}
