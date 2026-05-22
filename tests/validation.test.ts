import { describe, expect, it } from "vitest";
import {
	ManifestSchema,
	isSafeWorkspaceFile,
	validateVariantReceipt,
} from "@/lib/validation";

describe("variant receipt validation", () => {
	it("accepts a manifest with tests, build, commerce invariants, and changed files", () => {
		const result = validateVariantReceipt(
			{
				summary: "Updated campaign page.",
				changedFiles: ["src/ProductPage.tsx"],
				commandsRun: ["npm test", "npm run build"],
				testsPassed: true,
				buildPassed: true,
				commerceInvariantsPreserved: true,
				previewPath: "dist/index.html",
			},
			["src/ProductPage.tsx"],
		);
		expect(result.passed).toBe(true);
		expect(result.summary).toContain("Validation: passed");
	});

	it("rejects a manifest that did not build", () => {
		const result = validateVariantReceipt(
			{
				summary: "Updated campaign page.",
				changedFiles: ["src/ProductPage.tsx"],
				commandsRun: ["npm test", "npm run build"],
				testsPassed: true,
				buildPassed: false,
				commerceInvariantsPreserved: true,
				previewPath: "dist/index.html",
			},
			["src/ProductPage.tsx"],
		);
		expect(result.passed).toBe(false);
	});

	it("rejects changes to package and immutable commerce modules", () => {
		const result = validateVariantReceipt(
			{
				summary: "Updated campaign page.",
				changedFiles: ["package.json", "src/ProductPage.tsx"],
				commandsRun: ["npm test", "npm run build"],
				testsPassed: true,
				buildPassed: true,
				commerceInvariantsPreserved: true,
				previewPath: "dist/index.html",
			},
			["package.json", "src/cart.ts", "src/ProductPage.tsx"],
		);
		expect(result.passed).toBe(false);
		expect(result.summary).toContain(
			"Forbidden changes: package.json, src/cart.ts",
		);
	});

	it("rejects manifests that point preview output anywhere but dist/index.html", () => {
		expect(
			ManifestSchema.safeParse({
				summary: "Updated campaign page.",
				changedFiles: ["src/ProductPage.tsx"],
				commandsRun: ["npm test", "npm run build"],
				testsPassed: true,
				buildPassed: true,
				commerceInvariantsPreserved: true,
				previewPath: "../secret.html",
			}).success,
		).toBe(false);
	});

	it("rejects unsafe changed file paths", () => {
		const result = validateVariantReceipt(
			{
				summary: "Updated campaign page.",
				changedFiles: ["../package.json", "src/ProductPage.tsx"],
				commandsRun: ["npm test", "npm run build"],
				testsPassed: true,
				buildPassed: true,
				commerceInvariantsPreserved: true,
				previewPath: "dist/index.html",
			},
			["../package.json", "src/ProductPage.tsx"],
		);
		expect(result.passed).toBe(false);
		expect(result.summary).toContain(
			"Unsafe changed file paths: ../package.json",
		);
		expect(isSafeWorkspaceFile("src/ProductPage.tsx")).toBe(true);
		expect(isSafeWorkspaceFile("src/../package.json")).toBe(false);
		expect(isSafeWorkspaceFile("/etc/passwd")).toBe(false);
		expect(isSafeWorkspaceFile("C:/Users/demo/secret.txt")).toBe(false);
	});
});
