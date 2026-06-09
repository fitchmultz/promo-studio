import { describe, expect, it } from "vitest";
import { isUsablePreviewHtml } from "@/lib/preview-quality";

describe("preview quality", () => {
	it("rejects tiny preview fragments that are not complete storefronts", () => {
		expect(
			isUsablePreviewHtml(
				"<style>body::after{content:'Variant'}</style><div>Variant</div>",
			),
		).toBe(false);
	});

	it("accepts complete built HTML documents", () => {
		expect(
			isUsablePreviewHtml(
				`<!doctype html><html><body><main>${"storefront ".repeat(80)}</main></body></html>`,
			),
		).toBe(true);
	});
});
