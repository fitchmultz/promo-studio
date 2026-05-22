import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const REQUIRED_PREVIEW_PATH = "dist/index.html";

export const ManifestSchema = z.object({
	summary: z.string().min(1),
	changedFiles: z.array(z.string().min(1)).min(1),
	commandsRun: z.array(z.string().min(1)).min(2),
	testsPassed: z.boolean(),
	buildPassed: z.boolean(),
	commerceInvariantsPreserved: z.boolean(),
	previewPath: z.literal(REQUIRED_PREVIEW_PATH),
});

export type VariantManifest = z.infer<typeof ManifestSchema>;

export async function readVariantManifest(workspacePath: string) {
	const manifestPath = path.join(workspacePath, "artifact", "manifest.json");
	const raw = await readFile(manifestPath, "utf8");
	return ManifestSchema.parse(JSON.parse(raw));
}

export function isSafeWorkspaceFile(file: string) {
	const normalized = file.replaceAll("\\", "/");
	return (
		!normalized.includes(":") &&
		!path.posix.isAbsolute(normalized) &&
		normalized
			.split("/")
			.every((segment) => segment && segment !== "." && segment !== "..")
	);
}

const FORBIDDEN_CHANGED_FILES = new Set([
	"package.json",
	"package-lock.json",
	"src/cart.ts",
	"src/product.ts",
]);

export function validateVariantReceipt(
	manifest: VariantManifest,
	changedFiles: string[],
) {
	const commandsText = manifest.commandsRun.join("\n").toLowerCase();
	const unsafeChangedFiles = changedFiles.filter(
		(file) => !isSafeWorkspaceFile(file),
	);
	const forbiddenChanges = changedFiles.filter((file) =>
		FORBIDDEN_CHANGED_FILES.has(file),
	);
	const checks = [
		manifest.testsPassed,
		manifest.buildPassed,
		manifest.commerceInvariantsPreserved,
		commandsText.includes("npm test"),
		commandsText.includes("npm run build"),
		changedFiles.length > 0,
		unsafeChangedFiles.length === 0,
		forbiddenChanges.length === 0,
	];
	const passed = checks.every(Boolean);
	return {
		passed,
		summary: [
			`Manifest summary: ${manifest.summary}`,
			`Tests passed: ${manifest.testsPassed ? "yes" : "no"}`,
			`Build passed: ${manifest.buildPassed ? "yes" : "no"}`,
			`Commerce invariants preserved: ${manifest.commerceInvariantsPreserved ? "yes" : "no"}`,
			`Commands: ${manifest.commandsRun.join(" | ")}`,
			`Changed files: ${changedFiles.join(", ")}`,
			`Unsafe changed file paths: ${unsafeChangedFiles.length ? unsafeChangedFiles.join(", ") : "none"}`,
			`Forbidden changes: ${forbiddenChanges.length ? forbiddenChanges.join(", ") : "none"}`,
			`Preview path: ${manifest.previewPath}`,
			`Validation: ${passed ? "passed" : "failed"}`,
		].join("\n"),
	};
}
