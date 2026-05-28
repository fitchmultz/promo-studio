import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { inferRunPhase } from "@/lib/run-phase";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scheduleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agent/schedule-variant-run", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/agent/schedule-variant-run")>();
	return {
		...actual,
		scheduleVariantRunExecution: scheduleMock,
	};
});

function readRepoFile(relativePath: string) {
	return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const AUTO_EXECUTE_FIXTURE_GOAL = "Auto-execute contract";

describe("variant run auto-execute (Create Variant must run agents)", () => {
	afterEach(async () => {
		const { prisma } = await import("@/lib/db");
		await prisma.variantRun.deleteMany({
			where: { campaignGoal: AUTO_EXECUTE_FIXTURE_GOAL },
		});
	});

	afterAll(() => {
		vi.doUnmock("@/lib/agent/schedule-variant-run");
		vi.resetModules();
	});

	it("createVariantRun schedules execution by default", async () => {
		scheduleMock.mockClear();
		const { createVariantRun } = await import("@/lib/agent/runner");
		const { prisma } = await import("@/lib/db");
		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "demo@promostudio.test" },
		});
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: "ribbed-market-tote" },
		});

		const run = await createVariantRun({
			user,
			product,
			campaignBrief:
				"Regression: Create Variant must auto-start agent execution.",
			campaignGoal: AUTO_EXECUTE_FIXTURE_GOAL,
			agentCore: "codex",
			agentHarness: "sdk",
		});

		expect(scheduleMock).toHaveBeenCalledTimes(1);
		expect(scheduleMock).toHaveBeenCalledWith(
			run.id,
			expect.any(Function),
			undefined,
		);
	});

	it("createVariantRun skips scheduling when autoExecute is false", async () => {
		scheduleMock.mockClear();
		const { createVariantRun } = await import("@/lib/agent/runner");
		const { prisma } = await import("@/lib/db");
		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "demo@promostudio.test" },
		});
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: "ribbed-market-tote" },
		});

		await createVariantRun({
			user,
			product,
			campaignBrief:
				"Regression: worker queue tests opt out of auto execution.",
			campaignGoal: AUTO_EXECUTE_FIXTURE_GOAL,
			agentCore: "codex",
			agentHarness: "sdk",
			autoExecute: false,
		});

		expect(scheduleMock).not.toHaveBeenCalled();
	});

	it("scheduleVariantRunExecution invokes the executor without awaiting", async () => {
		const { scheduleVariantRunExecution } = await vi.importActual<
			typeof import("@/lib/agent/schedule-variant-run")
		>("@/lib/agent/schedule-variant-run");
		const execute = vi.fn().mockResolvedValue(null);
		scheduleVariantRunExecution("run-test", execute, { processRunner: vi.fn() });
		await new Promise((resolve) => setImmediate(resolve));
		expect(execute).toHaveBeenCalledWith("run-test", {
			processRunner: expect.any(Function),
		});
	});

	it("POST /api/variant-runs schedules execution via next/server after()", () => {
		const routeSource = readRepoFile("app/api/variant-runs/route.ts");
		expect(routeSource).toContain("autoExecute: false");
		expect(routeSource).toMatch(/after\s*\(\s*\(\)\s*=>\s*executeVariantRun/);
	});

	it("ActivityStream does not tell users to start runs:worker", () => {
		const source = readRepoFile("components/ActivityStream.tsx");
		expect(source).not.toContain("runs:worker");
		expect(source).not.toMatch(/run worker/i);
	});

	it('queued run phase shows "Starting agent", not a worker prompt', () => {
		const phase = inferRunPhase({
			status: "queued",
			agentCore: "cursor",
			hasPreview: false,
			events: [],
		});
		expect(phase.label).toBe("Starting agent");
		expect(phase.label).not.toMatch(/worker/i);
	});
});
