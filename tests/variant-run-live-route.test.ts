import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const findUniqueMock = vi.fn();
const queryRawMock = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/agent/transcript", () => ({
	parseAgentEvents: (text: string) => [
		{ id: "1", type: "log", raw: text, parsed: {} },
	],
}));
vi.mock("@/lib/db", () => ({
	prisma: {
		$queryRaw: queryRawMock,
		variantRun: { findUnique: findUniqueMock },
	},
}));

function run(overrides: Record<string, unknown> = {}) {
	return {
		id: "run-1",
		userId: "user-1",
		status: "succeeded",
		agentCore: "codex",
		transcript: "db tail",
		changedFiles: '["src/ProductPage.tsx"]',
		previewHtml: `<!doctype html><html><body><main>${"preview".repeat(100)}</main></body></html>`,
		codexCommand: "Codex TypeScript SDK runStreamed",
		passwordHash: "must-not-leak",
		user: { passwordHash: "must-not-leak" },
		...overrides,
	};
}

describe("variant run live API", () => {
	beforeEach(() => {
		requireUserMock
			.mockReset()
			.mockResolvedValue({ id: "user-1", role: "admin" });
		findUniqueMock.mockReset().mockResolvedValue(run());
		queryRawMock
			.mockReset()
			.mockResolvedValue([
				{ transcriptTail: '{"type":"tail"}\n', transcriptLength: 16 },
			]);
	});

	it("returns a slim live DTO without raw run or user fields", async () => {
		const { GET } = await import("@/app/api/variant-runs/[id]/route");
		const response = await GET(new Request("http://localhost/api/run"), {
			params: Promise.resolve({ id: "run-1" }),
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.run).toEqual({
			id: "run-1",
			status: "succeeded",
			hasPreview: true,
		});
		expect(payload.changedFiles).toBeUndefined();
		expect(payload.events).toHaveLength(1);
		expect(JSON.stringify(payload)).not.toContain("passwordHash");
		expect(JSON.stringify(payload)).not.toContain("must-not-leak");
		expect(queryRawMock).toHaveBeenCalledTimes(1);
		expect(findUniqueMock).toHaveBeenCalledWith(
			expect.objectContaining({ select: expect.any(Object) }),
		);
	});

	it("returns only a complete bounded transcript tail", async () => {
		queryRawMock.mockResolvedValueOnce([
			{
				transcriptTail: 'cut-off-line\n{"type":"tail"}\n',
				transcriptLength: 120_001,
			},
		]);
		const { GET } = await import("@/app/api/variant-runs/[id]/route");
		const response = await GET(new Request("http://localhost/api/run"), {
			params: Promise.resolve({ id: "run-1" }),
		});

		const payload = await response.json();
		expect(payload.events[0].raw).toBe('{"type":"tail"}\n');
	});

	it("forbids another user's run", async () => {
		requireUserMock.mockResolvedValue({ id: "user-2", role: "member" });
		const { GET } = await import("@/app/api/variant-runs/[id]/route");
		const response = await GET(new Request("http://localhost/api/run"), {
			params: Promise.resolve({ id: "run-1" }),
		});

		expect(response.status).toBe(403);
		expect(queryRawMock).not.toHaveBeenCalled();
	});
});
