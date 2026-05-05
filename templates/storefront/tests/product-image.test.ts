import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function cssRuleBody(css: string, selector: string) {
	const match = css.match(
		new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{([^}]+)\\}`),
	);
	return match?.[1] ?? "";
}

describe("Product image presentation", () => {
	it("preserves the full product photo inside campaign image frames", () => {
		const css = readFileSync("src/styles.css", "utf8");
		const rule = cssRuleBody(css, ".product-image img");

		expect(rule).toContain("object-fit: contain");
		expect(rule).toContain("max-height: 100%");
		expect(rule).toContain("max-width: 100%");
		expect(rule).toContain("min-height: 0");
		expect(rule).toContain("min-width: 0");
		expect(rule).not.toContain("object-fit: cover");
	});
});
