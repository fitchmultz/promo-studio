import { describe, expect, it } from "vitest";
import {
	ManifestSchema,
	isSafeWorkspaceFile,
	validateVariantReceipt,
} from "@/lib/validation";

const passingManifest = {
	summary: "Updated campaign page.",
	changedFiles: ["src/ProductPage.tsx"],
	commandsRun: ["npm test", "npm run build"],
	testsPassed: true,
	buildPassed: true,
	commerceInvariantsPreserved: true,
	previewPath: "dist/index.html" as const,
};

describe("variant receipt validation", () => {
	it("accepts a manifest with tests, build, commerce invariants, and detected source changes", () => {
		const result = validateVariantReceipt(passingManifest, {
			detectedChangedFiles: ["src/ProductPage.tsx"],
		});
		expect(result.passed).toBe(true);
		expect(result.changedFiles).toEqual(["src/ProductPage.tsx"]);
		expect(result.summary).toContain("Validation: passed");
	});

	it("rejects a manifest that did not build", () => {
		const result = validateVariantReceipt(
			{
				...passingManifest,
				buildPassed: false,
			},
			{ detectedChangedFiles: ["src/ProductPage.tsx"] },
		);
		expect(result.passed).toBe(false);
	});

	it("rejects self-reported changes that were not detected in the workspace", () => {
		const result = validateVariantReceipt(passingManifest, {
			detectedChangedFiles: ["artifact/manifest.json"],
		});
		expect(result.passed).toBe(false);
		expect(result.summary).toContain("Detected source changes: none");
		expect(result.summary).toContain(
			"Claimed but not detected: src/ProductPage.tsx",
		);
	});

	it("rejects detected workspace changes missing from the manifest", () => {
		const result = validateVariantReceipt(passingManifest, {
			detectedChangedFiles: [
				"src/ProductPage.tsx",
				"src/components/CampaignBanner.tsx",
				"vite.config.ts",
			],
		});
		expect(result.passed).toBe(false);
		expect(result.summary).toContain(
			"Detected changes missing from manifest: src/components/CampaignBanner.tsx, vite.config.ts",
		);
	});

	it("rejects claimed non-source changes except generated artifacts", () => {
		const result = validateVariantReceipt(
			{
				...passingManifest,
				changedFiles: ["src/ProductPage.tsx", "vite.config.ts"],
			},
			{ detectedChangedFiles: ["src/ProductPage.tsx", "vite.config.ts"] },
		);
		expect(result.passed).toBe(false);
		expect(result.summary).toContain(
			"Forbidden non-source changes: vite.config.ts",
		);
	});

	it("rejects changes to package and immutable commerce modules", () => {
		const result = validateVariantReceipt(
			{
				...passingManifest,
				changedFiles: ["package.json", "src/ProductPage.tsx"],
			},
			{
				detectedChangedFiles: [
					"package.json",
					"src/cart.ts",
					"src/ProductPage.tsx",
				],
			},
		);
		expect(result.passed).toBe(false);
		expect(result.summary).toContain(
			"Forbidden changes: package.json, src/cart.ts",
		);
	});

	it("rejects manifests that point preview output anywhere but dist/index.html", () => {
		expect(
			ManifestSchema.safeParse({
				...passingManifest,
				previewPath: "../secret.html",
			}).success,
		).toBe(false);
	});

	it("rejects unsafe changed file paths", () => {
		const result = validateVariantReceipt(
			{
				...passingManifest,
				changedFiles: ["../package.json", "src/ProductPage.tsx"],
			},
			{ detectedChangedFiles: ["../package.json", "src/ProductPage.tsx"] },
		);
		expect(result.passed).toBe(false);
		expect(result.summary).toContain("Unsafe detected paths: ../package.json");
		expect(isSafeWorkspaceFile("src/ProductPage.tsx")).toBe(true);
		expect(isSafeWorkspaceFile("src/../package.json")).toBe(false);
		expect(isSafeWorkspaceFile("/etc/passwd")).toBe(false);
		expect(isSafeWorkspaceFile("C:/Users/demo/secret.txt")).toBe(false);
	});
});
