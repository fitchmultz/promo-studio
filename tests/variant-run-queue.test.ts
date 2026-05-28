import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { finalizeVariantRun } from "@/lib/variant-run-queue";

describe("variant run queue", () => {
	it("returns the existing row when finalize loses ownership", async () => {
		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "demo@promostudio.test" },
		});
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: "ribbed-market-tote" },
		});
		const run = await prisma.variantRun.create({
			data: {
				productId: product.id,
				userId: user.id,
				status: "failed",
				campaignBrief: "Queue finalize race test brief.",
				campaignGoal: "Test",
				workspacePath: "/tmp/agent-workspaces/run-queue-test/storefront",
				requestedAuthMode: "auto",
				selectedAuthMode: "subscription",
				requestedModel: "gpt-5.5",
				selectedModel: "gpt-5.5",
				requestedEffort: "low",
				selectedEffort: "low",
				agentCore: "codex",
				agentHarness: "sdk",
				codexRuntime: "sdk",
				codexCommand: "Codex TypeScript SDK runStreamed",
				inputPrompt: "test",
				outputSummary: "test",
				error: "already failed",
			},
		});

		const finalized = await finalizeVariantRun(run.id, {
			status: "failed",
			error: "late worker",
			completedAt: new Date(),
		});

		expect(finalized?.status).toBe("failed");
		expect(finalized?.error).toBe("already failed");
	});
});
