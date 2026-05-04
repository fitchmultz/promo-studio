import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/redirects";

describe("safe redirect paths", () => {
	it("keeps local paths and rejects external redirect forms", () => {
		expect(safeRedirectPath("/proof")).toBe("/proof");
		expect(safeRedirectPath("https://evil.example.com/phish")).toBe("/studio");
		expect(safeRedirectPath("//evil.example.com/phish")).toBe("/studio");
		expect(safeRedirectPath("/\\evil.example.com")).toBe("/studio");
	});
});
