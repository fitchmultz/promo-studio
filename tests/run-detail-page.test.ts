import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
	notFound: () => {
		throw new Error("not found");
	},
	redirect: (path: string) => {
		throw new Error(`redirected to ${path}`);
	},
}));

vi.mock("@/components/ActivityStream", () => ({
	ActivityStream: () => "ACTIVITY_MARKER",
}));
vi.mock("@/components/BeforeAfter", () => ({
	BeforeAfter: () => "PREVIEW_MARKER",
}));
vi.mock("@/components/DiffViewer", () => ({
	DiffViewer: () => "DIFF_MARKER",
}));
vi.mock("@/components/RunDetailTabs", () => ({
	RunDetailTabs: () => "TABS_MARKER",
}));
vi.mock("@/components/RunReceipt", () => ({
	RunReceipt: () => "RECEIPT_MARKER",
}));
vi.mock("@/lib/auth", () => ({
	requireUser: vi.fn(async () => ({ id: "user-1", role: "admin" })),
}));
vi.mock("@/lib/codex-runner", () => ({
	parseCodexEvents: () => [],
}));
vi.mock("@/lib/db", () => ({
	prisma: {
		variantRun: {
			findUnique: findUniqueMock,
		},
	},
}));

function run(status: string) {
	return {
		id: "run-1",
		userId: "user-1",
		status,
		campaignGoal: "Holiday gift push",
		campaignBrief: "Make a campaign.",
		changedFiles: "[]",
		transcript: "",
		previewHtml: "",
		workspacePath: "/tmp/workspace",
		product: {
			id: "ribbed-market-tote",
			name: "Ribbed Market Tote",
			price: "$42.00",
			description: "A sturdy tote.",
			features: "[]",
			imageSrc: "/products/ribbed-market-tote.webp",
		},
	};
}

describe("RunDetailPage", () => {
	beforeEach(() => {
		findUniqueMock.mockReset();
	});

	it("keeps Codex activity above the evidence tabs while running", async () => {
		findUniqueMock.mockResolvedValue(run("running"));
		const { default: RunDetailPage } = await import(
			"../app/(studio)/runs/[id]/page"
		);

		const markup = renderToStaticMarkup(
			await RunDetailPage({ params: Promise.resolve({ id: "run-1" }) }),
		);

		expect(markup.indexOf("ACTIVITY_MARKER")).toBeLessThan(
			markup.indexOf("TABS_MARKER"),
		);
	});

	it("keeps Codex activity above the evidence tabs after completion", async () => {
		findUniqueMock.mockResolvedValue(run("succeeded"));
		const { default: RunDetailPage } = await import(
			"../app/(studio)/runs/[id]/page"
		);

		const markup = renderToStaticMarkup(
			await RunDetailPage({ params: Promise.resolve({ id: "run-1" }) }),
		);

		expect(markup.indexOf("ACTIVITY_MARKER")).toBeLessThan(
			markup.indexOf("TABS_MARKER"),
		);
	});
});
