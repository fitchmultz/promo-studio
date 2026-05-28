import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const buildDiffEntriesMock = vi.fn();
const detectChangedFilesMock = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/diff", () => ({ buildDiffEntries: buildDiffEntriesMock }));
vi.mock("@/lib/workspace", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/workspace")>();
	return {
		...actual,
		detectChangedFiles: detectChangedFilesMock,
	};
});
vi.mock("@/lib/db", () => ({
	prisma: {
		variantRun: {
			findUnique: vi.fn(),
		},
	},
}));

import { prisma } from "@/lib/db";

describe("variant run diff API", () => {
	beforeEach(() => {
		requireUserMock
			.mockReset()
			.mockResolvedValue({ id: "user-1", role: "admin" });
		buildDiffEntriesMock.mockReset().mockResolvedValue([]);
		detectChangedFilesMock.mockReset().mockResolvedValue([]);
		vi.mocked(prisma.variantRun.findUnique).mockReset();
	});

	it("diffs using the stored workspace path", async () => {
		const workspacePath = "/repo/agent-workspaces/run-1/storefront";
		vi.mocked(prisma.variantRun.findUnique).mockResolvedValue({
			id: "run-1",
			userId: "user-1",
			status: "succeeded",
			workspacePath,
			changedFiles: '["src/theme.ts"]',
		} as never);
		buildDiffEntriesMock.mockResolvedValue([
			{ path: "src/theme.ts", before: "", after: "x" },
		]);
		const { GET } = await import("@/app/api/variant-runs/[id]/diff/route");
		const response = await GET(new Request("http://localhost/diff"), {
			params: Promise.resolve({ id: "run-1" }),
		});

		expect(response.status).toBe(200);
		expect(buildDiffEntriesMock).toHaveBeenCalledWith(workspacePath, [
			"src/theme.ts",
		]);
	});

	it("returns 403 for non-owner viewers", async () => {
		requireUserMock.mockResolvedValue({ id: "user-2", role: "viewer" });
		vi.mocked(prisma.variantRun.findUnique).mockResolvedValue({
			id: "run-1",
			userId: "user-1",
			status: "succeeded",
			workspacePath: "/repo/agent-workspaces/run-1/storefront",
			changedFiles: "[]",
		} as never);
		const { GET } = await import("@/app/api/variant-runs/[id]/diff/route");
		const response = await GET(new Request("http://localhost/diff"), {
			params: Promise.resolve({ id: "run-1" }),
		});
		expect(response.status).toBe(403);
	});
});
