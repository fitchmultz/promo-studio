import type { Product } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildVariantPrompt } from "@/lib/variant-prompt";

const product: Product = {
	id: "ribbed-market-tote",
	slug: "ribbed-market-tote",
	name: "Ribbed Market Tote",
	price: "$42.00",
	description: "A sturdy everyday tote.",
	features: JSON.stringify(["Organic cotton canvas"]),
	imageSrc: "/products/ribbed-market-tote.webp",
	createdAt: new Date("2026-05-04T00:00:00Z"),
	updatedAt: new Date("2026-05-04T00:00:00Z"),
};

describe("buildVariantPrompt", () => {
	it("tells Codex not to attempt browser testing from the isolated workspace", () => {
		const prompt = buildVariantPrompt({
			product,
			campaignGoal: "Back-to-work launch",
			campaignBrief: "Make the tote feel ready for office commutes.",
		});

		expect(prompt).toContain("Do not attempt browser-based testing");
		expect(prompt).toContain("cannot reliably bind ports or access a browser");
		expect(prompt).toContain("Preserve the full product photo");
		expect(prompt).toContain("object-fit: contain");
		expect(prompt).toContain("npm test");
		expect(prompt).toContain("npm run build");
	});
});
