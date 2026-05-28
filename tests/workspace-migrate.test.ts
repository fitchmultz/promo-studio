import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { migrateLegacyWorkspaceRecords } from "@/lib/workspace-migrate";

describe("migrateLegacyWorkspaceRecords", () => {
	it("rewrites stored codex-workspaces paths to agent-workspaces", async () => {
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
				campaignBrief: "Legacy path migration test brief.",
				campaignGoal: "Test",
				workspacePath: "/tmp/codex-workspaces/run-migrate-test/storefront",
				requestedAuthMode: "auto",
				selectedAuthMode: "subscription",
				requestedModel: "gpt-5.5",
				selectedModel: "gpt-5.5",
				requestedEffort: "low",
				selectedEffort: "low",
				agentCore: "codex",
				agentHarness: "sdk",
				codexRuntime: "sdk",
				codexCommand:
					"codex exec workingDirectory=/tmp/codex-workspaces/run-migrate-test/storefront",
				inputPrompt: "test",
				outputSummary: "test",
				error: "test",
			},
		});

		const migrated = await migrateLegacyWorkspaceRecords();
		expect(migrated).toBeGreaterThanOrEqual(1);

		const updated = await prisma.variantRun.findUniqueOrThrow({
			where: { id: run.id },
		});
		expect(updated.workspacePath).toBe(
			"/tmp/agent-workspaces/run-migrate-test/storefront",
		);
		expect(updated.codexCommand).toContain("agent-workspaces");
		expect(updated.codexCommand).not.toContain("codex-workspaces");

		await prisma.variantRun.delete({ where: { id: run.id } });
	});
});
