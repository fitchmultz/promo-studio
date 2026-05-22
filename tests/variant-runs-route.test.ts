import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const createVariantRunMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/codex-runner", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/codex-runner")>();
	return {
		...actual,
		createVariantRun: createVariantRunMock,
		parseCodexEvents: () => [],
	};
});
vi.mock("@/lib/db", () => ({
	prisma: {
		product: { findMany: findManyMock },
		variantRun: { findMany: vi.fn() },
	},
}));

describe("variant run API", () => {
	beforeEach(() => {
		requireUserMock
			.mockReset()
			.mockResolvedValue({ id: "user-1", role: "admin" });
		createVariantRunMock
			.mockReset()
			.mockResolvedValue({ id: "run-1", status: "running", transcript: "" });
		findManyMock.mockReset().mockResolvedValue([
			{
				id: "ribbed-market-tote",
				name: "Ribbed Market Tote",
				features: "[]",
			},
		]);
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
			status: "running",
		});
		expect(createVariantRunMock).toHaveBeenCalledWith(
			expect.objectContaining({
				campaignGoal: "Holiday gift push",
				agentCore: "codex",
				agentHarness: "sdk",
				requestedAuthMode: "auto",
				requestedModel: "gpt-5.5",
				requestedEffort: "low",
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
				requestedModel: "gpt-5.5-mini",
				requestedEffort: "medium",
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
