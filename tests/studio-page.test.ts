import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StudioPage from "../app/(studio)/studio/page";

const { findManyMock } = vi.hoisted(() => ({
	findManyMock: vi.fn(),
}));

vi.mock("@/components/VariantForm", () => ({
	VariantForm: () => null,
}));

vi.mock("@/components/StudioHeroIntro", () => ({
	StudioHeroIntro: () => "STUDIO_HERO_INTRO",
}));

vi.mock("@/lib/auth", () => ({
	requireUser: vi.fn(async () => ({ name: "Demo User" })),
}));

vi.mock("@/lib/db", () => ({
	prisma: {
		product: {
			findMany: findManyMock,
		},
	},
}));

describe("StudioPage", () => {
	beforeEach(() => {
		findManyMock.mockResolvedValue([
			{
				id: "ribbed-market-tote",
				slug: "ribbed-market-tote",
				name: "Ribbed Market Tote",
				price: "$42.00",
				description: "A sturdy everyday tote.",
				features: JSON.stringify(["Organic cotton canvas"]),
				imageSrc: "/products/ribbed-market-tote.webp",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]);
	});

	it("shows the seeded product image instead of the plain placeholder", async () => {
		const markup = renderToStaticMarkup(await StudioPage());

		expect(markup).toContain("ribbed-market-tote.webp");
		expect(markup).toContain("Ribbed Market Tote");
		expect(markup).not.toContain("Plain tote image area");
		expect(markup).toContain("STUDIO_HERO_INTRO");
		expect(markup).not.toContain("Codex edits an isolated");
	});
});
