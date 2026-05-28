import {
	codexAutomationDescriptorParts,
	codexAutomationExecArgs,
} from "@/lib/agent/codex-automation-policy";
import { codexModelArgs, codexReasoningArgs, paths } from "@/lib/config";
import type { AgentCore, AgentHarness } from "@/lib/agent/types";

function buildCodexExecInvocation(
	workspace: string,
	requestedModel: string,
	requestedEffort: string,
) {
	return [
		"codex",
		"exec",
		"--json",
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
		"--session-id",
		runId,
		"--session-dir",
		paths.piSessions,
	];
	if (requestedModel) parts.push("--model", requestedModel);
	return parts.join(" ");
}

export function buildInvocationDescriptor(params: {
	core: AgentCore;
	harness: AgentHarness;
	runId: string;
	workspace: string;
	requestedModel: string;
	requestedEffort: string;
	selectedModel: string;
	selectedEffort: string;
}): string {
	if (params.core === "pi") {
		return buildPiJsonInvocation(params.requestedModel, params.runId);
	}
	if (params.harness === "exec") {
		return buildCodexExecInvocation(
			params.workspace,
			params.requestedModel,
			params.requestedEffort,
		);
	}
	return buildCodexSdkInvocation({
		workspace: params.workspace,
		selectedModel: params.selectedModel,
		selectedEffort: params.selectedEffort,
	});
}

export function runtimeLabel(core: AgentCore, runtime: AgentHarness): string {
	if (core === "pi") return "pi JSON CLI";
	return runtime === "exec" ? "codex exec" : "Codex SDK";
}

export function agentSummary(params: {
	core: AgentCore;
	selectedModel: string;
	selectedEffort: string;
}): string {
	const agentName = params.core === "pi" ? "Pi" : "Codex";
	if (params.core === "pi") {
		return `${agentName} ${params.selectedModel} is editing an isolated storefront workspace.`;
	}
	return `${agentName} ${params.selectedModel} is editing an isolated storefront workspace with ${params.selectedEffort} reasoning.`;
}
