import {
	codexAutomationDescriptorParts,
	codexAutomationExecArgs,
} from "@/lib/agent/codex-automation-policy";
import { cursorAutomationDescriptorParts } from "@/lib/agent/cursor-automation-policy";
import { agentDisplayName } from "@/lib/agent/definitions";
import { codexModelArgs, codexReasoningArgs, paths } from "@/lib/config";
import type { AgentCore, AgentHarness } from "@/lib/agent/types";

interface InvocationParams {
	core: AgentCore;
	harness: AgentHarness;
	runId: string;
	workspace: string;
	requestedModel: string;
	requestedEffort: string;
	selectedModel: string;
	selectedEffort: string;
}

function buildCodexExecInvocation(
	workspace: string,
	requestedModel: string,
	requestedEffort: string,
) {
	return [
		"codex",
		"exec",
		...codexAutomationExecArgs(workspace),
		...codexModelArgs(requestedModel),
		...codexReasoningArgs(requestedEffort),
		"-",
	].join(" ");
}

function buildCodexSdkInvocation(params: {
	workspace: string;
	selectedModel: string;
	selectedEffort: string;
}) {
	return [
		"Codex TypeScript SDK runStreamed",
		`workingDirectory=${params.workspace}`,
		...codexAutomationDescriptorParts(),
		`model=${params.selectedModel}`,
		`modelReasoningEffort=${params.selectedEffort}`,
	].join(" ");
}

function buildPiJsonInvocation(requestedModel: string, runId: string) {
	const parts = [
		"pi",
		"--mode",
		"json",
		"--approve",
		"--session-id",
		runId,
		"--session-dir",
		paths.piSessions,
	];
	if (requestedModel) parts.push("--model", requestedModel);
	return parts.join(" ");
}

function buildCursorSdkInvocation(params: {
	workspace: string;
	selectedModel: string;
}) {
	return [
		"Cursor TypeScript SDK Agent.send",
		...cursorAutomationDescriptorParts(params.workspace, params.selectedModel),
	].join(" ");
}

const INVOCATION_BUILDERS: Record<
	AgentCore,
	(params: InvocationParams) => string
> = {
	codex: (params) =>
		params.harness === "exec"
			? buildCodexExecInvocation(
					params.workspace,
					params.requestedModel,
					params.requestedEffort,
				)
			: buildCodexSdkInvocation({
					workspace: params.workspace,
					selectedModel: params.selectedModel,
					selectedEffort: params.selectedEffort,
				}),
	pi: (params) => buildPiJsonInvocation(params.requestedModel, params.runId),
	cursor: (params) =>
		buildCursorSdkInvocation({
			workspace: params.workspace,
			selectedModel: params.selectedModel,
		}),
};

const RUNTIME_LABELS: Record<AgentCore, (runtime: AgentHarness) => string> = {
	codex: (runtime) => (runtime === "exec" ? "codex exec" : "Codex SDK"),
	pi: () => "pi JSON CLI",
	cursor: () => "Cursor SDK",
};

export function buildInvocationDescriptor(params: InvocationParams): string {
	return INVOCATION_BUILDERS[params.core](params);
}

export function runtimeLabel(core: AgentCore, runtime: AgentHarness): string {
	return RUNTIME_LABELS[core](runtime);
}

export function agentSummary(params: {
	core: AgentCore;
	selectedModel: string;
	selectedEffort: string;
}): string {
	const agentName = agentDisplayName(params.core);
	if (params.core === "codex") {
		return `${agentName} ${params.selectedModel} is editing an isolated storefront workspace with ${params.selectedEffort} reasoning.`;
	}
	return `${agentName} ${params.selectedModel} is editing an isolated storefront workspace.`;
}
