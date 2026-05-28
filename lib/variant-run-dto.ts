import type { Prisma } from "@prisma/client";
import { formatWorkspacePathForDisplay } from "@/lib/agent-display";

export const variantRunListSelect = {
	id: true,
	status: true,
	campaignBrief: true,
	campaignGoal: true,
	workspacePath: true,
	requestedAuthMode: true,
	selectedAuthMode: true,
	requestedModel: true,
	selectedModel: true,
	requestedEffort: true,
	selectedEffort: true,
	agentCore: true,
	agentHarness: true,
	codexRuntime: true,
	codexCommand: true,
	testsPassed: true,
	buildPassed: true,
	commerceInvariantsOk: true,
	changedFiles: true,
	validationResult: true,
	error: true,
	outputSummary: true,
	startedAt: true,
	completedAt: true,
	product: {
		select: {
			id: true,
			slug: true,
			name: true,
			price: true,
			imageSrc: true,
		},
	},
} satisfies Prisma.VariantRunSelect;

export const variantRunDiffSelect = {
	id: true,
	userId: true,
	status: true,
	workspacePath: true,
	changedFiles: true,
} satisfies Prisma.VariantRunSelect;

export const variantRunTranscriptSelect = {
	id: true,
	userId: true,
	transcript: true,
	agentCore: true,
	codexCommand: true,
} satisfies Prisma.VariantRunSelect;

export const variantRunLiveSelect = {
	id: true,
	userId: true,
	status: true,
	agentCore: true,
} satisfies Prisma.VariantRunSelect;

type VariantRunListRecord = Prisma.VariantRunGetPayload<{
	select: typeof variantRunListSelect;
}>;

type VariantRunLiveRecord = Prisma.VariantRunGetPayload<{
	select: typeof variantRunLiveSelect;
}>;

export interface VariantRunListDto {
	id: string;
	status: string;
	campaignBrief: string;
	campaignGoal: string;
	workspacePath: string;
	requestedAuthMode: string;
	selectedAuthMode: string;
	requestedModel: string;
	selectedModel: string;
	requestedEffort: string;
	selectedEffort: string;
	agentCore: string;
	agentHarness: string;
	codexRuntime: string;
	codexCommand: string;
	testsPassed: boolean | null;
	buildPassed: boolean | null;
	commerceInvariantsOk: boolean | null;
	changedFiles: string;
	validationResult: string;
	error: string | null;
	outputSummary: string;
	startedAt: string;
	completedAt: string | null;
	product: {
		id: string;
		slug: string;
		name: string;
		price: string;
		imageSrc: string;
	};
}

export interface VariantRunLiveDto {
	id: string;
	status: string;
	hasPreview: boolean;
}

export function serializeVariantRunListItem(
	run: VariantRunListRecord,
): VariantRunListDto {
	return {
		id: run.id,
		status: run.status,
		campaignBrief: run.campaignBrief,
		campaignGoal: run.campaignGoal,
		workspacePath: formatWorkspacePathForDisplay(run.workspacePath),
		requestedAuthMode: run.requestedAuthMode,
		selectedAuthMode: run.selectedAuthMode,
		requestedModel: run.requestedModel,
		selectedModel: run.selectedModel,
		requestedEffort: run.requestedEffort,
		selectedEffort: run.selectedEffort,
		agentCore: run.agentCore,
		agentHarness: run.agentHarness,
		codexRuntime: run.codexRuntime,
		codexCommand: run.codexCommand,
		testsPassed: run.testsPassed,
		buildPassed: run.buildPassed,
		commerceInvariantsOk: run.commerceInvariantsOk,
		changedFiles: run.changedFiles,
		validationResult: run.validationResult,
		error: run.error,
		outputSummary: run.outputSummary,
		startedAt: run.startedAt.toISOString(),
		completedAt: run.completedAt?.toISOString() ?? null,
		product: {
			id: run.product.id,
			slug: run.product.slug,
			name: run.product.name,
			price: run.product.price,
			imageSrc: run.product.imageSrc,
		},
	};
}

export function serializeVariantRunLive(
	run: VariantRunLiveRecord,
): VariantRunLiveDto {
	return {
		id: run.id,
		status: run.status,
		hasPreview: run.status === "succeeded",
	};
}
