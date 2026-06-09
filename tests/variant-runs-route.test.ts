import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const createVariantRunMock = vi.fn();
const executeVariantRunMock = vi.fn();
const afterMock = vi.fn((callback: () => void | Promise<void>) => {
	void callback();
});
const productFindManyMock = vi.fn();
const variantRunFindManyMock = vi.fn();
const variantRunFindFirstMock = vi.fn();

vi.mock("next/server", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/server")>();
	return { ...actual, after: afterMock };
});
vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/agent/runner", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/agent/runner")>();
	return {
		...actual,
		createVariantRun: createVariantRunMock,
		executeVariantRun: executeVariantRunMock,
	};
});
vi.mock("@/lib/agent/transcript", () => ({
	parseAgentEvents: () => [],
}));
vi.mock("@/lib/db", () => ({
	prisma: {
		product: { findMany: productFindManyMock },
		variantRun: {
			findFirst: variantRunFindFirstMock,
			findMany: variantRunFindManyMock,
		},
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
		executeVariantRunMock.mockReset().mockResolvedValue(null);
		afterMock.mockClear();
		productFindManyMock.mockReset().mockResolvedValue([
			{
				id: "ribbed-market-tote",
				name: "Ribbed Market Tote",
				features: "[]",
			},
		]);
		variantRunFindFirstMock.mockReset().mockResolvedValue(null);
		variantRunFindManyMock.mockReset().mockResolvedValue([]);
	});

	it("lists explicit run DTOs without user secrets", async () => {
		variantRunFindManyMock.mockResolvedValue([listedRun()]);
		const { GET } = await import("@/app/api/variant-runs/route");

		const response = await GET(
			new Request("http://localhost:3000/api/variant-runs"),
		);

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(JSON.stringify(payload)).not.toContain("passwordHash");
		expect(JSON.stringify(payload)).not.toContain("must-not-leak");
		expect(payload.runs[0]).toMatchObject({
			id: "run-1",
			startedAt: "2026-05-26T12:00:00.000Z",
			product: { name: "Ribbed Market Tote" },
		});
		expect(payload.pagination).toMatchObject({
			limit: 30,
			hasMore: false,
			nextCursor: null,
		});
		expect(variantRunFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				select: expect.any(Object),
				take: 31,
				orderBy: [{ startedAt: "desc" }, { id: "desc" }],
			}),
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
				scheduler: afterMock,
				runtimeSpec: expect.objectContaining({
					core: "codex",
					harness: "sdk",
					requestedAuthMode: "auto",
					requestedModel: "gpt-5.5",
					requestedEffort: "low",
				}),
			}),
		);
		expect(afterMock).not.toHaveBeenCalled();
	});

	it("passes Cursor SDK runtime spec from form fields", async () => {
		const { POST } = await import("@/app/api/variant-runs/route");
		const response = await POST(
			new Request("http://localhost:3000/api/variant-runs", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: new URLSearchParams({
					campaignBrief: "Create a vivid commuter gift campaign.",
					campaignGoal: "Holiday gift push",
					productId: "ribbed-market-tote",
					agentCore: "cursor",
					agentHarness: "sdk",
					model: "composer-2.5-fast",
				}),
			}),
		);

		expect(response.status).toBe(202);
		expect(createVariantRunMock).toHaveBeenCalledWith(
			expect.objectContaining({
				runtimeSpec: expect.objectContaining({
					core: "cursor",
					harness: "sdk",
					requestedModel: "composer-2.5-fast",
					legacyRuntime: "cursor-sdk",
				}),
			}),
		);
	});

	it("returns 400 when createVariantRun rejects missing Cursor API key", async () => {
		createVariantRunMock.mockRejectedValue(
			new Error(
				"CURSOR_API_KEY is required for Cursor SDK storefront variant runs.",
			),
		);
		const { POST } = await import("@/app/api/variant-runs/route");
		const response = await POST(
			new Request("http://localhost:3000/api/variant-runs", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: new URLSearchParams({
					campaignBrief: "Create a vivid commuter gift campaign.",
					agentCore: "cursor",
					agentHarness: "sdk",
				}),
			}),
		);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining("CURSOR_API_KEY"),
		});
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

	it("rejects JSON campaign creation with form guidance", async () => {
		const { POST } = await import("@/app/api/variant-runs/route");
		const response = await POST(
			new Request("http://localhost:3000/api/variant-runs", {
				method: "POST",
				headers: {
					origin: "http://localhost:3000",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					campaignBrief: "Create a vivid commuter gift campaign.",
				}),
			}),
		);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: "Send campaign data as form-encoded.",
		});
		expect(createVariantRunMock).not.toHaveBeenCalled();
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

	it("rejects cross-origin POST requests", async () => {
		const { POST } = await import("@/app/api/variant-runs/route");
		const response = await POST(
			new Request("http://localhost:3000/api/variant-runs", {
				method: "POST",
				headers: { origin: "http://evil.example" },
				body: new URLSearchParams({
					campaignBrief: "Create a vivid commuter gift campaign.",
				}),
			}),
		);
		expect(response.status).toBe(403);
		expect(createVariantRunMock).not.toHaveBeenCalled();
	});

	it("returns 400 when createVariantRun rejects missing API keys", async () => {
		createVariantRunMock.mockRejectedValue(
			new Error(
				"API-key mode requested, but neither CODEX_API_KEY nor OPENAI_API_KEY is configured.",
			),
		);
		const { POST } = await import("@/app/api/variant-runs/route");
		const response = await POST(
			new Request("http://localhost:3000/api/variant-runs", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: new URLSearchParams({
					campaignBrief: "Create a vivid commuter gift campaign.",
					authMode: "api-key",
				}),
			}),
		);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining("API-key mode requested"),
		});
	});

	it("returns stored workspace paths in list DTOs", async () => {
		const workspacePath = "/tmp/agent-workspaces/run-1/storefront";
		variantRunFindManyMock.mockResolvedValue([listedRun({ workspacePath })]);
		const { GET } = await import("@/app/api/variant-runs/route");
		const response = await GET(
			new Request("http://localhost:3000/api/variant-runs"),
		);
		const payload = await response.json();
		expect(payload.runs[0].workspacePath).toBe(workspacePath);
	});

	it("ignores stale pagination cursors instead of throwing", async () => {
		variantRunFindFirstMock.mockResolvedValue(null);
		variantRunFindManyMock.mockResolvedValue([listedRun({ id: "run-1" })]);
		const { GET } = await import("@/app/api/variant-runs/route");
		const response = await GET(
			new Request(
				"http://localhost:3000/api/variant-runs?limit=2&cursor=missing-run",
			),
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.runs.map((run: { id: string }) => run.id)).toEqual([
			"run-1",
		]);
		expect(variantRunFindManyMock).toHaveBeenCalledWith(
			expect.not.objectContaining({ cursor: expect.any(Object) }),
		);
	});

	it("paginates run lists with cursor and limit", async () => {
		variantRunFindFirstMock.mockResolvedValue({ id: "run-1" });
		variantRunFindManyMock.mockResolvedValue([
			listedRun({ id: "run-2" }),
			listedRun({ id: "run-3" }),
			listedRun({ id: "run-4" }),
		]);
		const { GET } = await import("@/app/api/variant-runs/route");
		const response = await GET(
			new Request(
				"http://localhost:3000/api/variant-runs?limit=2&cursor=run-1",
			),
		);
		const payload = await response.json();

		expect(payload.runs.map((run: { id: string }) => run.id)).toEqual([
			"run-2",
			"run-3",
		]);
		expect(payload.pagination).toEqual({
			limit: 2,
			hasMore: true,
			nextCursor: "run-3",
		});
		expect(variantRunFindFirstMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "run-1" } }),
		);
		expect(variantRunFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				cursor: { id: "run-1" },
				orderBy: [{ startedAt: "desc" }, { id: "desc" }],
				skip: 1,
				take: 3,
			}),
		);
	});
});
