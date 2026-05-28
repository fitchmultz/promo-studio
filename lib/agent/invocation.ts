import {
	codexAutomationDescriptorParts,
	codexAutomationExecArgs,
} from "@/lib/agent/codex-automation-policy";
import { cursorAutomationDescriptorParts } from "@/lib/agent/cursor-automation-policy";
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

function buildCursorSdkInvocation(params: {
	workspace: string;
	selectedModel: string;
}) {
	return [
		"Cursor TypeScript SDK Agent.send",
		...cursorAutomationDescriptorParts(params.workspace, params.selectedModel),
	].join(" ");
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
	if (params.core === "cursor") {
		return buildCursorSdkInvocation({
			workspace: params.workspace,
			selectedModel: params.selectedModel,
		});
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
	if (core === "cursor") return "Cursor SDK";
	return runtime === "exec" ? "codex exec" : "Codex SDK";
}

function agentDisplayNameForCore(core: AgentCore): string {
	if (core === "pi") return "Pi";
	if (core === "cursor") return "Cursor";
	return "Codex";
}

export function agentSummary(params: {
	core: AgentCore;
	selectedModel: string;
	selectedEffort: string;
}): string {
	const agentName = agentDisplayNameForCore(params.core);
	if (params.core === "pi" || params.core === "cursor") {
		return `${agentName} ${params.selectedModel} is editing an isolated storefront workspace.`;
	}
	return `${agentName} ${params.selectedModel} is editing an isolated storefront workspace with ${params.selectedEffort} reasoning.`;
}
