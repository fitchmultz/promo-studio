import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductPage } from "../src/ProductPage";

describe("ProductPage", () => {
	it("renders the tote page with commerce data", () => {
		const html = renderToString(<ProductPage />);
		expect(html).toContain("Ribbed Market Tote");
		expect(html).toContain("42.00");
		expect(html).toContain("RMT-001");
		expect(html).toContain("/products/ribbed-market-tote.webp");
	});
});
