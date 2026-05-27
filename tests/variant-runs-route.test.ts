import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const createVariantRunMock = vi.fn();
const recoverStaleVariantRunsMock = vi.fn();
const productFindManyMock = vi.fn();
const variantRunFindManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/codex-runner", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/codex-runner")>();
	return {
		...actual,
		createVariantRun: createVariantRunMock,
		parseCodexEvents: () => [],
		recoverStaleVariantRuns: recoverStaleVariantRunsMock,
	};
});
vi.mock("@/lib/db", () => ({
	prisma: {
		product: { findMany: productFindManyMock },
		variantRun: { findMany: variantRunFindManyMock },
	},
}));

function listedRun(overrides: Record<string, unknown> = {}) {
	return {
		id: "run-1",
		status: "succeeded",
		campaignBrief: "Create a vivid commuter gift campaign.",
		campaignGoal: "Holiday gift push",
		workspacePath: "/tmp/agent-workspaces/run-1/storefront",
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
		testsPassed: true,
		buildPassed: true,
		commerceInvariantsOk: true,
		changedFiles: "[]",
		validationResult: "Validation: passed",
		error: null,
		outputSummary: "Created variant.",
		startedAt: new Date("2026-05-26T12:00:00Z"),
		completedAt: new Date("2026-05-26T12:02:00Z"),
		product: {
			id: "ribbed-market-tote",
			slug: "ribbed-market-tote",
			name: "Ribbed Market Tote",
			price: "$42.00",
			imageSrc: "/products/ribbed-market-tote.webp",
		},
		user: { passwordHash: "must-not-leak" },
		passwordHash: "must-not-leak",
		...overrides,
	};
}

describe("variant run API", () => {
	beforeEach(() => {
		requireUserMock
			.mockReset()
			.mockResolvedValue({ id: "user-1", role: "admin" });
		createVariantRunMock
			.mockReset()
			.mockResolvedValue({ id: "run-1", status: "queued", transcript: "" });
		recoverStaleVariantRunsMock.mockReset().mockResolvedValue(undefined);
		productFindManyMock.mockReset().mockResolvedValue([
			{
				id: "ribbed-market-tote",
				name: "Ribbed Market Tote",
				features: "[]",
			},
		]);
		variantRunFindManyMock.mockReset().mockResolvedValue([]);
	});

	it("lists explicit run DTOs without user secrets", async () => {
		variantRunFindManyMock.mockResolvedValue([listedRun()]);
		const { GET } = await import("@/app/api/variant-runs/route");

		const response = await GET();

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(JSON.stringify(payload)).not.toContain("passwordHash");
		expect(JSON.stringify(payload)).not.toContain("must-not-leak");
		expect(payload.runs[0]).toMatchObject({
			id: "run-1",
			startedAt: "2026-05-26T12:00:00.000Z",
			product: { name: "Ribbed Market Tote" },
		});
		expect(variantRunFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({ select: expect.any(Object) }),
		);
	});

	it("creates an authenticated variant run", async () => {
		const { POST } = await import("@/app/api/variant-runs/route");
		const response = await POST(
			new Request("http://localhost:3000/api/variant-runs", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: new URLSearchParams({
					campaignBrief: "Create a vivid commuter gift campaign.",
					campaignGoal: "Holiday gift push",
					productId: "ribbed-market-tote",
				}),
			}),
		);
		expect(response.status).toBe(202);
		await expect(response.json()).resolves.toMatchObject({
			id: "run-1",
			status: "queued",
		});
		expect(createVariantRunMock).toHaveBeenCalledWith(
			expect.objectContaining({
				campaignGoal: "Holiday gift push",
				runtimeSpec: expect.objectContaining({
					core: "codex",
					harness: "sdk",
					requestedAuthMode: "auto",
					requestedModel: "gpt-5.5",
					requestedEffort: "low",
				}),
			}),
		);
	});

	it("passes safe Codex model and reasoning overrides to the runner", async () => {
		const { POST } = await import("@/app/api/variant-runs/route");
		const response = await POST(
			new Request("http://localhost:3000/api/variant-runs", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: new URLSearchParams({
					campaignBrief: "Create a vivid commuter gift campaign.",
					campaignGoal: "Holiday gift push",
					productId: "ribbed-market-tote",
					model: "gpt-5.5-mini",
					reasoningEffort: "medium",
				}),
			}),
		);

		expect(response.status).toBe(202);
		expect(createVariantRunMock).toHaveBeenCalledWith(
			expect.objectContaining({
				runtimeSpec: expect.objectContaining({
					requestedModel: "gpt-5.5-mini",
					requestedEffort: "medium",
				}),
			}),
		);
	});

	it("rejects short briefs", async () => {
		const { POST } = await import("@/app/api/variant-runs/route");
		const response = await POST(
			new Request("http://localhost:3000/api/variant-runs", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: new URLSearchParams({ campaignBrief: "short" }),
			}),
		);
		expect(response.status).toBe(400);
		expect(createVariantRunMock).not.toHaveBeenCalled();
	});
});
